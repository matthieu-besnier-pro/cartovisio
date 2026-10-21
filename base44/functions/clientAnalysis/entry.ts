import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// AI analysis of the geolocated customer base.
//
// PRIVACY: the frontend sends ONLY aggregates (counts per département, per
// point de vente, per activity, average affiliation rate…). No names, emails,
// phone numbers or SIRET ever leave the app.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    try { await base44.auth.me(); } catch { /* keep auth soft like the chatbot */ }

    const body = await req.json();
    const stats = body?.stats;
    const question = String(body?.question || '').trim();
    if (!stats || typeof stats !== 'object') {
      return Response.json({ error: 'Statistiques manquantes' }, { status: 400 });
    }

    const prompt = `Tu es analyste commercial pour le Pôle Agricole du Groupe Dubreuil.
On te fournit des statistiques AGRÉGÉES sur un portefeuille clients agricole géolocalisé.
Statuts : ACTIF = client actif, PERDU_2024 = compte arrêté après 2024, PERDU_2025 = compte arrêté après 2025.
"taux d'affiliation PDV" = pourcentage d'affiliation du client à son point de vente.

DONNÉES (JSON) :
${JSON.stringify(stats, null, 1)}

${question ? `QUESTION SPÉCIFIQUE DE L'UTILISATEUR : "${question}"\n` : ''}
Rédige une analyse en français, concise et actionnable, structurée en markdown avec ces sections :

## Vue d'ensemble
2-3 phrases : volume du portefeuille, répartition actifs/perdus, taux de perte global.

## Zones à risque
Les départements / points de vente où la perte de clients est la plus forte (cite les chiffres et le taux de perte en %). Sois précis.

## Points forts
Les zones et activités où le portefeuille est solide ou le taux d'affiliation élevé.

## Recommandations
3 à 5 actions concrètes et priorisées (reconquête, prospection, animation de PDV), chacune en une ligne, ancrée sur les chiffres ci-dessus.

Règles : appuie CHAQUE affirmation sur les chiffres fournis, n'invente aucune donnée absente, ne cite jamais de client nommément (tu n'en as pas). Pas de préambule, commence directement par "## Vue d'ensemble".`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const text = typeof result === 'string' ? result : (result?.text || result?.output || JSON.stringify(result));

    return Response.json({ analysis: text });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
