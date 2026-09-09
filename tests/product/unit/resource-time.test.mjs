import test from 'node:test';
import assert from 'node:assert/strict';
import { localInstant,occupationWindow,overlap,localDescription,hoursBlockers,resourceWindowBlockers,validResourceTimeZone } from '../../../packages/domain/src/resource-time.ts';

const rules={timeZone:'Europe/Zurich',hoursMode:'always',weeklyHours:[],sourceTruth:'internal_controlled',sourcePolicy:'Agenda interne fictif contrôlé pour cette recette'};
test('resource occupation includes exact elapsed preparation and cleanup and treats adjacent bounds as non-overlapping',()=>{
  const start=localInstant('2026-09-09T10:00','Europe/Zurich'),w=occupationWindow(start,90,30,20);
  assert.equal(new Date(w.occupiedStart).toISOString(),'2026-09-09T07:30:00.000Z');
  assert.equal(new Date(w.occupiedEnd).toISOString(),'2026-09-09T09:50:00.000Z');
  assert.equal(w.end-w.start,90*60000);assert.equal(w.occupiedEnd-w.occupiedStart,140*60000);
  assert.equal(overlap(w.occupiedStart,w.occupiedEnd,w.occupiedEnd,w.occupiedEnd+60000),false);
  assert.equal(overlap(w.occupiedStart,w.occupiedEnd,w.occupiedStart-60000,w.occupiedStart),false);
  assert.ok(resourceWindowBlockers(w.occupiedStart,w.occupiedEnd,rules,true,[{start:w.start-60000,end:w.start}]).includes('resource_closed'));
  assert.deepEqual(occupationWindow(start,1,0,0),{start,end:start+60000,occupiedStart:start,occupiedEnd:start+60000});
  for(const args of [[start,0,0,0],[start,90,-1,0],[start,90,0,1441],[start,0.5,0,0],[NaN,90,0,0]]) assert.throws(()=>occupationWindow(...args),{code:'invalid_duration'});
});

test('Zurich DST gaps and repetitions are explicit and durations retain actual elapsed minutes across both changes',()=>{
  assert.throws(()=>localInstant('2026-03-29T02:30','Europe/Zurich'),{code:'invalid_local_time'});
  assert.throws(()=>localInstant('2026-03-29T02:30','Europe/Zurich','+01:00'),{code:'invalid_local_time'});
  assert.throws(()=>localInstant('2026-10-25T02:30','Europe/Zurich'),{code:'invalid_local_time'});
  const early=localInstant('2026-10-25T02:30','Europe/Zurich','+02:00'),late=localInstant('2026-10-25T02:30','Europe/Zurich','+01:00');
  assert.equal(late-early,3600000);assert.equal(new Date(early).toISOString(),'2026-10-25T00:30:00.000Z');
  assert.equal(new Date(late).toISOString(),'2026-10-25T01:30:00.000Z');
  assert.throws(()=>localInstant('2026-09-09T10:00','Europe/Zurich','+01:00'),{code:'invalid_local_time'});
  const spring=occupationWindow(localInstant('2026-03-29T01:30','Europe/Zurich'),90,0,0);
  assert.equal(localDescription(spring.end,'Europe/Zurich').local,'2026-03-29T04:00');
  const fall=occupationWindow(early,90,0,0);assert.equal(localDescription(fall.end,'Europe/Zurich').local,'2026-10-25T03:00');
  assert.equal(fall.end-fall.start,5400000);
});

test('named zones, calendar validity, weekly boundaries, midnight and ambiguous hours never silently adjust',()=>{
  assert.equal(validResourceTimeZone('Europe/Zurich'),true);assert.equal(validResourceTimeZone('UTC'),true);assert.equal(validResourceTimeZone('+01:00'),false);
  assert.throws(()=>localInstant('2026-02-30T10:00','Europe/Zurich'),{code:'invalid_local_time'});
  assert.throws(()=>localInstant('2026-09-09T10:00','Mars/Olympus'),{code:'invalid_local_time'});
  assert.equal(new Date(localInstant('2026-09-09T10:00','America/New_York')).toISOString(),'2026-09-09T14:00:00.000Z');
  assert.equal(new Date(localInstant('2026-09-09T10:00','UTC')).toISOString(),'2026-09-09T10:00:00.000Z');
  const start=localInstant('2026-09-09T23:30','Europe/Zurich'),window=occupationWindow(start,90,30,0);
  const weekly={...rules,hoursMode:'weekly',weeklyHours:[{weekday:3,from:'23:00',to:'24:00'},{weekday:4,from:'00:00',to:'01:00'}]};
  assert.deepEqual(hoursBlockers(window.occupiedStart,window.occupiedEnd,weekly),[]);
  assert.deepEqual(hoursBlockers(window.occupiedStart-1,window.occupiedEnd,weekly),['outside_hours']);
  const dst=localInstant('2026-10-25T01:00','Europe/Zurich');
  assert.deepEqual(hoursBlockers(dst,dst+3600000,{...rules,hoursMode:'weekly',weeklyHours:[{weekday:7,from:'01:00',to:'02:30'}]}),['ambiguous_hours_configuration']);
});

test('source ownership, unknown hours and disabled resources block preview without inventing external capabilities',()=>{
  const start=localInstant('2026-09-09T10:00','Europe/Zurich'),end=start+3600000;
  assert.deepEqual(resourceWindowBlockers(start,end,rules,true,[]),[]);
  assert.ok(resourceWindowBlockers(start,end,{...rules,sourceTruth:'unknown'},true,[]).includes('source_unknown'));
  assert.ok(resourceWindowBlockers(start,end,{...rules,sourcePolicy:null},true,[]).includes('source_unknown'));
  for(const sourceTruth of ['microsoft_resource','external_uncontrolled']) assert.ok(resourceWindowBlockers(start,end,{...rules,sourceTruth},true,[]).includes('external_verification_required'));
  assert.deepEqual(resourceWindowBlockers(start,end,{...rules,hoursMode:'unknown'},false,[]),['hours_unknown','resource_disabled']);
  assert.deepEqual(hoursBlockers(start,start+33*86400000,rules),['invalid_occupation_window']);
});
