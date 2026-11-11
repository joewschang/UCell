const {Req, Query, Header, Get} = require('@nestjs/common');
const {authorizeTreePrincipal} = require('./modules/binary-tree/tree-authorization');
const {findRoots} = require('./tree-directory.cjs');
const viewRoles = ['SUPER_ADMIN','ORG_GEO_VIEW','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT'];

exports.register = function register(Controller) {
  const proto=Controller.prototype;
  if(!proto.summary || proto.roots) throw Error('Unexpected geo controller');
  proto.roots=async function(req,query){
    await authorizeTreePrincipal(this.db,req.user,viewRoles);
    return findRoots(this.db,query,true);
  };
  const method=Object.getOwnPropertyDescriptor(proto,'roots');
  Req()(proto,'roots',0);
  Query()(proto,'roots',1);
  Header('Cache-Control','private, no-store')(proto,'roots',method);
  Get('roots')(proto,'roots',method);
};
