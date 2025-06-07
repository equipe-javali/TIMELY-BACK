import express from 'express';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const db = new sqlite3.Database('banco.db');
db.serialize(() => {
    // Adicionar coluna "tipo" se não existir
    db.run("PRAGMA foreign_keys=ON");
    db.run("CREATE TABLE IF NOT EXISTS leitura (cartao TEXT, timestamp INTEGER, tipo TEXT)");
    
    // Verificar se a coluna "tipo" já existe
    db.all("PRAGMA table_info(leitura)", (err, rows) => {
        if (err) {
            console.error("Erro ao verificar tabela:", err);
            return;
        }
        
        // Se não encontrar a coluna tipo, adicione-a
        if (!rows.some(row => row.name === 'tipo')) {
            db.run("ALTER TABLE leitura ADD COLUMN tipo TEXT DEFAULT 'entrada'");
        }
    });
});

const app = express();

// Middleware CORS
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Timely API - Controle de Ponto');
});

// Endpoint para buscar os registros com tipo de registro
app.get('/ultimos_registros', (req, res) => {
    console.log('Buscando últimos registros');
    db.all(`
        SELECT 
            cartao as codigo, 
            timestamp,
            tipo
        FROM leitura 
        ORDER BY timestamp DESC 
        LIMIT 50
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
        
        res.json({
            success: true,
            data: rows
        });
    });
});

// Endpoint para registrar passagem do cartão RFID
app.post('/dados', (req, res) => {
    const { cartao } = req.body;
    const timestamp = Date.now();
    
    // Buscar último registro deste cartão para determinar se é entrada ou saída
    db.get(
        "SELECT tipo FROM leitura WHERE cartao = ? ORDER BY timestamp DESC LIMIT 1", 
        [cartao.codigo], 
        (err, row) => {
            // Determina se é entrada ou saída com base no registro anterior
            // Se não houver registro ou o último foi saída, então é entrada
            // Se o último foi entrada, então é saída
            const novoTipo = (!row || row.tipo === 'saida') ? 'entrada' : 'saida';
            
            // Insere novo registro com o tipo determinado
            db.run(
                "INSERT INTO leitura (cartao, timestamp, tipo) VALUES (?, ?, ?)",
                [cartao.codigo, timestamp, novoTipo],
                function(err) {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            error: err.message
                        });
                    }
                    
                    res.json({ 
                        success: true, 
                        data: {
                            cartao: req.body.cartao,
                            timestamp: timestamp,
                            tipo: novoTipo
                        }
                    });
                }
            );
        }
    );
});

// Endpoint para obter o status atual do cartão (útil para o frontend)
app.get('/status_cartao/:codigo', (req, res) => {
    const codigoCartao = req.params.codigo;
    
    db.get(
        "SELECT tipo, timestamp FROM leitura WHERE cartao = ? ORDER BY timestamp DESC LIMIT 1", 
        [codigoCartao], 
        (err, row) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
            
            res.json({
                success: true,
                data: row || { tipo: null, timestamp: null }
            });
        }
    );
});

const server = app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});

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