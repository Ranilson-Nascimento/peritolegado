import { MongoClient } from 'mongodb';
import { config } from '../config';
import { DatabaseAdapter } from './types';

/**
 * MongoDB adapter using the official mongodb driver. Suitable for MongoDB Atlas
 * and self-hosted deployments.
 */
export class MongoDBAdapter implements DatabaseAdapter<MongoClient> {
  private client: MongoClient | null = null;

  async connect(): Promise<MongoClient> {
    this.client = new MongoClient(config.mongodb.uri);
    await this.client.connect();
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async testConnection(): Promise<void> {
    const client = this.client ?? (await this.connect());
    const result = await client.db().command({ ping: 1 });
    console.log('MongoDB ping response:', result);
    if (!this.client) {
      await client.close();
    }
  }
}