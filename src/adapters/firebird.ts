import { createNativeClient, getDefaultLibraryFilename, NativeClient, Attachment } from 'node-firebird-driver-native';
import { config } from '../config';
import { DatabaseAdapter } from './types';

/**
 * Firebird adapter using node-firebird-driver-native. Supports Firebird 3+.
 */
export class FirebirdAdapter implements DatabaseAdapter<{ client: NativeClient; attachment: Attachment }> {
  private client: NativeClient | null = null;
  private attachment: Attachment | null = null;

  async connect(): Promise<{ client: NativeClient; attachment: Attachment }> {
    // Initialize the native client with the default library filename (fbclient)
    this.client = createNativeClient(getDefaultLibraryFilename());
    // Attach to an existing database
    this.attachment = await this.client.attach({
      database: config.firebird.database,
      user: config.firebird.user,
      password: config.firebird.password,
    });
    return { client: this.client, attachment: this.attachment };
  }

  async disconnect(): Promise<void> {
    if (this.attachment) {
      await this.attachment.detach();
      this.attachment = null;
    }
    if (this.client) {
      await this.client.dispose();
      this.client = null;
    }
  }

  async testConnection(): Promise<void> {
    const { client, attachment } = this.attachment && this.client
      ? { client: this.client, attachment: this.attachment }
      : await this.connect();
    const transaction = await attachment.startTransaction();
    // Firebird always has table rdb$database; select a constant from it
    const resultSet = await attachment.executeQuery(transaction, 'SELECT 1 FROM rdb$database', []);
    const rows = await resultSet.fetch();
    console.log('Firebird test result:', rows);
    await resultSet.close();
    await transaction.commit();
    if (!this.attachment || !this.client) {
      await this.disconnect();
    }
  }
}