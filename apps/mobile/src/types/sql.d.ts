// Drizzle migration files, bundled as strings by babel-plugin-inline-import.
declare module '*.sql' {
  const sql: string;
  export default sql;
}
