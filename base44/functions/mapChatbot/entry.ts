import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const message = String(body?.message || '').trim();
    const vendors = Array.isArray(body?.vendors) ? body.vendors : [];
    const communes = Array.isArray(body?.communes) ? body.communes : [];
    const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];

    if (!message) return Response.json({ error: 'Message vide' }, { status: 400 });

    const vendorList = vendors.map(v => `${v.name} (${v.count})`).join(', ') || 'aucun';
    const communeSample = communes.slice(0, 500).join(', ');
    const histTxt = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

    const prompt = `Tu es un assistant qui aide à modifier une carte de secteurs commerciaux français (communes colorées par commercial).
État actuel de la carte :
- Commerciaux : ${vendorList}
- Communes chargées (noms) : ${communeSample || 'aucune'}

L'utilisateur demande : "${message}"

${histTxt ? 'Historique récent :\n' + histTxt + '\n' : ''}
Réponds UNIQUEMENT avec un objet JSON décrivant l'action à effectuer.
Actions possibles :
- {"action":"assign","commune":"<nom ou code de commune>","vendor":"<nom du commercial>","message":"<explication>"}
- {"action":"remove","commune":"<nom ou code>","message":"<explication>"}
- {"action":"setColor","vendor":"<nom>","color":"<hex #rrggbb>","message":"<explication>"}
- {"action":"showOnly","vendor":"<nom>","message":"<explication>"}
- {"action":"showAll","message":"<explication>"}
- {"action":"rename","vendor":"<ancien nom>","newName":"<nouveau nom>","message":"<explication>"}
- {"action":"answer","message":"<réponse texte quand aucune modification n'est nécessaire>"}

Règles :
- Pour "assign" et "remove", utilise le nom exact de commune parmi celles chargées si possible.
- Pour "setColor", donne une couleur hex valide (#rrggbb).
- Sois concis dans "message".
- Si la demande est une question ou ne nécessite pas de modification, utilise "answer".`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['assign', 'remove', 'setColor', 'showOnly', 'showAll', 'rename', 'answer'] },
          commune: { type: 'string' },
          vendor: { type: 'string' },
          newName: { type: 'string' },
          color: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['action', 'message'],
      },
    });

    return Response.json({ action: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}