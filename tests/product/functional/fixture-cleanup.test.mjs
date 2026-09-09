import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';

test('owned fixture cleanup lets a closing connection finish without forced termination',async()=>{
  const h=await createIdentityTestDatabase('https://issuer.test.example');
  const closing=new pg.Client(h.applicationConfig);const failures=[];
  closing.on('error',()=>failures.push('unexpected_connection_error'));
  await closing.connect();
  let ended=false;
  const disconnect=(async()=>{await delay(150);await closing.end();ended=true;})();
  try {
    await h.cleanup();assert.equal(ended,true,'cleanup must wait for owned connections to close');
  } finally {await disconnect;}
  assert.deepEqual(failures,[]);
});
