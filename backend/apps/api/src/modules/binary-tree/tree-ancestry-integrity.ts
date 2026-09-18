import {Prisma} from '@ucell/database';
import {AsOfContext} from '@ucell/shared';
/** Fixed-depth join validation of canonical ancestry; never recursively expands a tree. */
export async function treeAncestryCompleteness(tx:Prisma.TransactionClient,id:string,time:AsOfContext){
 const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
 const [result]=await tx.$queryRaw<Array<{invalid:string}>>`SELECT count(*)::text invalid
 FROM organization.binary_tree_membership m
 JOIN organization.company_sponsor_designation root ON root.binary_tree_id=m.binary_tree_id
 LEFT JOIN organization.placement_tree_evidence e ON e.placement_tree_evidence_id=m.placement_tree_evidence_id AND e.recorded_at<=${known}
 WHERE m.binary_tree_id=${id}::uuid AND m.effective_from<=${at} AND m.recorded_at<=${known}
 AND(e.placement_tree_evidence_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM organization.binary_tree_ancestry self WHERE self.binary_tree_id=m.binary_tree_id AND self.ancestor_qualification_id=m.qualification_id AND self.descendant_qualification_id=m.qualification_id AND self.depth=0 AND self.effective_from=m.effective_from AND self.recorded_at<=${known})
 OR NOT EXISTS(SELECT 1 FROM organization.binary_tree_ancestry top WHERE top.binary_tree_id=m.binary_tree_id AND top.ancestor_qualification_id=root.qualification_id AND top.descendant_qualification_id=m.qualification_id AND top.recorded_at<=${known})
 OR EXISTS(
  SELECT 1 FROM organization.binary_tree_ancestry parent
  JOIN organization.tree_canonical_position c ON c.binary_tree_id=parent.binary_tree_id AND c.occupant_qualification_id=parent.ancestor_qualification_id
  WHERE parent.binary_tree_id=m.binary_tree_id AND parent.descendant_qualification_id=e.parent_qualification_id AND parent.recorded_at<=${known}
   AND NOT EXISTS(SELECT 1 FROM organization.binary_tree_ancestry child WHERE child.binary_tree_id=m.binary_tree_id AND child.descendant_qualification_id=m.qualification_id
    AND child.ancestor_qualification_id=parent.ancestor_qualification_id AND child.depth=parent.depth+1
    AND child.first_side=CASE WHEN parent.depth=0 THEN e.side ELSE parent.first_side END AND child.effective_from=m.effective_from AND child.recorded_at<=${known}))
 OR EXISTS(
  SELECT 1 FROM organization.binary_tree_ancestry child
  JOIN organization.tree_canonical_position c ON c.binary_tree_id=child.binary_tree_id AND c.occupant_qualification_id=child.ancestor_qualification_id
  WHERE child.binary_tree_id=m.binary_tree_id AND child.descendant_qualification_id=m.qualification_id AND child.depth>0 AND child.recorded_at<=${known}
   AND NOT EXISTS(SELECT 1 FROM organization.binary_tree_ancestry parent WHERE parent.binary_tree_id=m.binary_tree_id AND parent.descendant_qualification_id=e.parent_qualification_id
    AND parent.ancestor_qualification_id=child.ancestor_qualification_id AND parent.depth+1=child.depth
    AND child.first_side=CASE WHEN parent.depth=0 THEN e.side ELSE parent.first_side END AND parent.recorded_at<=${known}))
 )`;
 return result.invalid;
}
