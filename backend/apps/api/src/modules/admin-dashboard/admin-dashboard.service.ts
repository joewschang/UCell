import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma:PrismaService){}

  async summary(){
    const now=new Date();
    const startToday=new Date(now); startToday.setHours(0,0,0,0);
    const startMonth=new Date(now.getFullYear(),now.getMonth(),1);

    const [
      persons,qualifications,activeQualifications,
      draftApplications,submittedApplications,
      todayOrders,monthOrders,openRecoveries,payableEntries
    ]=await Promise.all([
      this.prisma.person.count(),
      this.prisma.qualification.count(),
      this.prisma.qualification.count({where:{status:'EFFECTIVE',activeFlag:true}}),
      this.prisma.membershipApplication.count({where:{status:'DRAFT'}}),
      this.prisma.membershipApplication.count({where:{status:'SUBMITTED'}}),
      this.prisma.order.count({where:{createdAt:{gte:startToday}}}),
      this.prisma.order.count({where:{createdAt:{gte:startMonth}}}),
      this.prisma.bonusRecoveryEvent.count({where:{status:{in:['OPEN','OFFSETTING']}}}),
      this.prisma.payableEntry.count({where:{status:'OPEN'}}),
    ]);

    return {
      generatedAt:now,
      persons,qualifications,activeQualifications,
      applications:{draft:draftApplications,submitted:submittedApplications},
      orders:{today:todayOrders,month:monthOrders},
      recoveries:{open:openRecoveries},
      payable:{open:payableEntries},
      ruleVersionCode:'R1.0B',
    };
  }
}
