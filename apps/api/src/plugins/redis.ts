import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on("error", (err) => {
    console.error("Redis connection error", err);
  });

  await redis.connect();
  console.info("Redis connected");

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, { name: "redis" });
