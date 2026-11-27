import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
// Set PGLITE_MODULE to an installed @electric-sql/pglite module when testing
// without a local PostgreSQL service. No remote database or credentials are used.
const moduleName=process.env.PGLITE_MODULE;
const {PGlite}=await import(moduleName?pathToFileURL(path.resolve(moduleName)).href:'@electric-sql/pglite');
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');`);
 const initial=await fs.readFile(new URL('../supabase/migrations/202611160001_arena.sql',import.meta.url),'utf8');
 await db.exec(initial.slice(0,initial.indexOf('do $$ begin')));
 await db.exec(`alter table private_events add column deleted_at timestamptz;
 create table arena_event_grants(event_id text,user_id uuid);`);
 await db.exec(await fs.readFile(new URL('../supabase/migrations/202611270005_referee_management.sql',import.meta.url),'utf8'));
 const result=await db.exec(await fs.readFile(new URL('./referee-management.sql',import.meta.url),'utf8'));
 assert.match(result.at(-1).rows[0].validation,/^PASS/);
 const rights=await db.query(`select has_function_privilege('authenticated','arena_manage_referee(uuid,uuid,text,text)','execute') as deletion,
 has_function_privilege('anon','arena_referee_links(uuid)','execute') as links,
 has_function_privilege('authenticated','arena_member_directory(uuid,text,text,integer,integer)','execute') as directory`);
 assert.deepEqual(rights.rows[0],{deletion:false,links:false,directory:false});
 assert.equal((await db.query('select count(*)::int as count from profiles')).rows[0].count,0);
 console.log(result.at(-1).rows[0].validation);console.log('PASS: SQL compiles in PostgreSQL; direct anonymous/authenticated RPC access denied; fixture transaction fully rolled back.');
}finally{await db.close();}
