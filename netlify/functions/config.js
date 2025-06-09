exports.handler = async (event, context) => {
    // Configurar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Solo permitir GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Obtener variables de entorno
        const config = {
            apiBase: process.env.API_BASE_URL || 'https://demo.tpteibarra.ar/api',
            authToken: process.env.API_TOKEN ? `Token ${process.env.API_TOKEN}` : null
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(config)
        };
    } catch (error) {
        console.error('Error loading config:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 