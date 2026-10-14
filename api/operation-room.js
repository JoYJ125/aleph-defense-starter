import { RULE_IDS } from '../src/decider.mjs';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const rules=RULE_IDS.map(id=>({id,status:'configured',source:'server_code'}));
  const detection={status:'not_run',confirmedEvents:null};
  const revocation={status:'not_run',revokedDevices:null};
  const recovery={status:'not_run',verifiedVersion:null};
  return res.status(200).json({
    schema:'byteback.operation-room.v1',rules,detection,revocation,recovery,
    redactedRecords:[
      ...rules.map(r=>({area:'rule',reference:r.id,status:r.status})),
      {area:'detection',reference:'[redacted]',status:detection.status,count:detection.confirmedEvents},
      {area:'revocation',reference:'[redacted]',status:revocation.status,count:revocation.revokedDevices},
      {area:'recovery',reference:'[redacted]',status:recovery.status,version:recovery.verifiedVersion}
    ]
  });
}
