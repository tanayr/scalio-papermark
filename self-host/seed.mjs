import { db, TEAM_ID, ROOM_ID } from './db.mjs';
import { randomToken, normalizeEmail } from './access.mjs';

export async function seed(client = db) {
  const emails = (process.env.ADMIN_EMAILS || 'tanay@scalio.app,aditya@scalio.app').split(',').map(normalizeEmail);
  await client.team.upsert({ where: { id: TEAM_ID }, update: {}, create: { id: TEAM_ID, name: 'Scalio' } });
  for (const email of emails) {
    const user = await client.user.upsert({ where: { email }, update: {}, create: { email, name: email.split('@')[0] } });
    await client.userTeam.upsert({ where: { userId_teamId: { userId: user.id, teamId: TEAM_ID } }, update: { role: 'ADMIN' }, create: { userId: user.id, teamId: TEAM_ID, role: 'ADMIN' } });
  }
  await client.dataroom.upsert({ where: { id: ROOM_ID }, update: {}, create: { id: ROOM_ID, pId: 'dr_scalio', name: 'Scalio investor room', teamId: TEAM_ID } });
  if (!await client.link.findFirst({ where: { dataroomId: ROOM_ID, isArchived: false } })) {
    await client.link.create({ data: { id: randomToken(), dataroomId: ROOM_ID, linkType: 'DATAROOM_LINK', name: 'Investor access', allowList: [], denyList: [], emailProtected: true, emailAuthenticated: true, allowDownload: false } });
  }
}
if (process.argv[1]?.endsWith('/seed.mjs')) {
  await seed();
  await db.$disconnect();
  console.log('Scalio room and administrators ready.');
}
