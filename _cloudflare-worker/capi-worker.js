/**
 * Cloudflare Worker — Meta Conversions API (CAPI)
 *
 * Rota: actomarketing.com.br/api/events
 *
 * Como funciona:
 *   Browser dispara pixel → POST /api/events → este Worker → Meta CAPI
 *
 * Para ativar:
 *   1. Defina as variáveis de ambiente no painel do Cloudflare:
 *      - META_PIXEL_ID    → ID do seu Pixel no Gerenciador de Eventos
 *      - META_ACCESS_TOKEN → Token gerado em: Business Settings > Integrações de Sistema
 *   2. No Cloudflare Workers, adicione a rota:
 *      actomarketing.com.br/api/events
 */

const CAPI_ENDPOINT = 'https://graph.facebook.com/v19.0';
const N8N_WEBHOOK = 'http://2.25.170.161:5678/webhook/54044c35-b389-4889-ac96-655eaaefe788';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders('https://actomarketing.com.br') });
    }

    // Recebe lead do site e repassa para o N8n
    if (request.method === 'POST' && url.pathname === '/api/lead') {
      return handleLead(request);
    }

    // Só intercepta POST em /api/events
    if (request.method === 'POST' && url.pathname === '/api/events') {
      return handleCAPIEvent(request, env);
    }

    // Todo o resto passa direto para o GitHub Pages
    return fetch(request);
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleLead(request) {
  const cors = corsHeaders('https://actomarketing.com.br');
  try {
    const body = await request.json();
    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}

async function handleCAPIEvent(request, env) {
  // Cabeçalhos CORS para o pixel do browser conseguir enviar
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://actomarketing.com.br',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();

    // Envia para a API do Meta
    const metaRes = await fetch(
      `${CAPI_ENDPOINT}/${env.META_PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: body.events,
          // test_event_code: 'TEST12345', // descomente para testar
        }),
      }
    );

    const result = await metaRes.json();
    return new Response(JSON.stringify(result), {
      status: metaRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
