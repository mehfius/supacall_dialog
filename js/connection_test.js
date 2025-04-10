function testConnection(url) {
    const testSocket = io(url, {
        query: {
            room: 'test-room',
            user: 'test-user',
            room_name: 'Test Room',
            card_date: new Date().toISOString()
        }
    });

    testSocket.on('connect', function () {
        console.log(`Test connection to ${url}: Connected to server`);
        alert(`Conexão com ${url} funcionando!`);
        testSocket.disconnect(); // Close the test connection
    });

    testSocket.on('connect_error', function (error) {
        console.error(`Test connection to ${url} error:`, error);
        alert(`Erro ao conectar a ${url}. Verifique a URL e tente novamente.`);
        testSocket.disconnect(); // Close the test connection
    });
}

// Export the function for use in other files
export { testConnection }; 