import express from "express";
import { createServer } from "http";
import cors from "cors";
import env from "dotenv";
import cluster from "cluster";
import os from "os";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
env.config();

const totalCPUs = os.cpus().length;

if (cluster.isPrimary) {
    // Fork workers.
    for (let i = 0; i < totalCPUs; i++) {
        cluster.fork();
    }

    cluster.on("exit", () => {
        cluster.fork();
    });
} else {
    const app = express();

    //Socket IO
    const httpServer = createServer();
    const io = new Server(httpServer, {
        cors: {
            origin: 'http://192.168.1.113/',
            credentials: true,
        }
    });

    //Redis
    const pubClient = createClient();
    const subClient = pubClient.duplicate();

    const socketPort = process.argv[5];

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        io.listen(socketPort);
    });

    //Connecting to socket.io
    io.on("connection", socket => {
        console.log(`Connection: ${socket.id}`);

        socket.on('disconnect', function () {
            console.log("disconnect: ", socket.id);
        });
    });

    const port = process.argv[3];

    app.get('/', async (req, res) => {
        const value = await pubClient.get('key');

        const data = JSON.stringify(value);
        //return res.send(data);
        return res.send(`hi from port ${port}`);
    })

    app.listen(port, () => {
        console.log(`started on port ${port}`);
    });
}