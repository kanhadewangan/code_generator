import redis from 'redis';
import dotenv from 'dotenv';
dotenv.config({
    path: "../.env",
    
})

const rclient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

rclient.on('error', (err) => console.log('Redis Client Error', err));

await rclient.connect();

export default rclient;