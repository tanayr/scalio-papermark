import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
// v0.12.0's AGPL data-room UI uses the business flag for its feature switches.
await db.team.upsert({where:{id:'scalio-invest'},update:{plan:'business'},create:{id:'scalio-invest',name:'Scalio',plan:'business'}});
for(const email of process.env.ADMIN_EMAILS.split(',').map(e=>e.trim().toLowerCase())){
 const user=await db.user.upsert({where:{email},update:{},create:{email,name:email.split('@')[0]}});
 await db.userTeam.upsert({where:{userId_teamId:{userId:user.id,teamId:'scalio-invest'}},update:{role:'ADMIN'},create:{userId:user.id,teamId:'scalio-invest',role:'ADMIN'}});
}
await db.brand.upsert({where:{teamId:'scalio-invest'},update:{},create:{teamId:'scalio-invest',logo:'/scalio-logo.png',brandColor:'#ffffff',accentColor:'#19AA57'}});
for(const room of await db.dataroom.findMany({where:{teamId:'scalio-invest'}})){
 await db.dataroomBrand.upsert({where:{dataroomId:room.id},update:{},create:{dataroomId:room.id,logo:'/scalio-logo.png',brandColor:'#ffffff',accentColor:'#19AA57'}});
}
await db.$disconnect();
console.log('Scalio workspace and administrators ready.');
