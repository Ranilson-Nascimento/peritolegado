/**
 * Defines a common interface for all database adapters. Each adapter
 * should handle its own connection management and expose a way to
 * perform a simple test query. More complex operations (schema
 * inspection, streaming rows, inserting batches) can be added later.
 */
export interface DatabaseAdapter<ConnectionType = any> {
  /**
   * Establish a connection to the database. Should throw an error
   * if the connection cannot be established.
   */
  connect(): Promise<ConnectionType>;

  /**
   * Close the connection to the database.
   */
  disconnect(): Promise<void>;

  /**
   * Perform a simple operation to ensure the connection is working.
   * Can be a trivial SELECT or ping operation.
   */
  testConnection(): Promise<void>;
}