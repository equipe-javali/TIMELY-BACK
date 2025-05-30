import express from 'express';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('banco.db');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS leitura (cartao TEXT, timestamp INTEGER)");
});

const app = express();

app.use(bodyParser.urlencoded());

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/dados', (req, res) => {
    const { cartao } = req.body;

    db.serialize(() => {
        db.exec(`INSERT INTO leitura (cartao, timestamp) VALUES ('${cartao.codigo}', '${Date.now()}')`);
    });

    res.send(JSON.stringify(req.body));
});

app.listen(3000);

async function gracefulShutdown() {
    console.log('Shutting down server...');

    db.close();

    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
