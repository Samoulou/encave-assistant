import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { loginPage } from './browser-actions.mjs';

export async function recoverConnectionSession(page,h,capture=async()=>{}){
 await page.goto(h.appOrigin+'/connexions');await page.getByLabel('Nom de la connexion').fill('Accueil après reconnexion');let originalKey,oldCallback;
 await page.route('**/api/connections/microsoft/start',async route=>{originalKey=route.request().headers()['idempotency-key'];const response=await route.fetch(),body=await response.json();oldCallback=h.microsoft.approve(body.url,'a');await route.abort('failed');});
 await page.getByRole('button',{name:'Connecter Microsoft 365',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('n’est pas confirmé');await page.unrouteAll();
 await page.context().clearCookies();await loginPage(page,h.appOrigin);await page.goto(h.appOrigin+'/connexions');await expect(page.getByRole('button',{name:'Vérifier la commande'})).toBeVisible();await capture('new-session-pending');
 let retryKey;await page.route('**/api/connections/microsoft/start',async route=>{retryKey=route.request().headers()['idempotency-key'];await route.continue();});await page.getByRole('button',{name:'Vérifier la commande'}).click();
 await expect(page.getByRole('heading',{name:'Commande à vérifier'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Reconnecter',exact:true})).toBeEnabled();assert.equal(retryKey,originalKey);await capture('new-session-recovered');await page.unrouteAll();
 const original=(await h.pool.query('SELECT id FROM provider_connections')).rows;assert.equal(original.length,1);
 await page.getByRole('button',{name:'Reconnecter',exact:true}).click();await page.getByRole('button',{name:'Compte synthétique A'}).click();await expect(page.getByText('Ressources à choisir',{exact:true})).toBeVisible();await capture('new-session-authorized');
 const rows=(await h.pool.query('SELECT id,status FROM provider_connections')).rows;assert.equal(rows.length,1);assert.equal(rows[0].id,original[0].id);assert.equal(rows[0].status,'selection_required');
 const rejected=await page.request.get(oldCallback,{maxRedirects:0});assert.match(rejected.headers().location,/error=oauth_invalid/);
}
