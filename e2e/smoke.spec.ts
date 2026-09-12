import{expect,test}from'@playwright/test';test('GridLoom exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'GridLoom command center'})).toBeVisible();await page.getByRole('link',{name:'Operations'}).click();const telemetry=page.getByRole('region',{name:'Telemetry investigation'});await telemetry.getByRole('textbox',{name:'Search telemetry'}).fill('no-match-fixture');await expect(telemetry).toContainText('No telemetry matches both filters.');await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

test('outage recovery persists failed verification and restores after telemetry refresh', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });
    const action = async (name: string) => page.getByRole('button', { name, exact: true }).click();
    const save = async () => { await action('Save command'); await expect(page.getByRole('dialog')).toHaveCount(0); };
    await actor.selectOption('actor-2');
    await page.getByRole('button', { name: /^Grid outages/ }).click();
    await action('Create grid outages');
    await page.getByRole('textbox', { name: 'Record title', exact: true }).fill('Feeder outage');
    await page.getByRole('combobox', { name: 'Site', exact: true }).selectOption('site-1');
    await page.getByRole('textbox', { name: 'Outage cause', exact: true }).fill('Feeder protection trip'); await save();
    await action('Acknowledge recovery'); await save();
    await action('Declare site outage'); await save();
    await page.getByRole('button', { name: /^Outage recovery stages/ }).click();
    await action('Verify recovery telemetry'); await save();
    await expect(page.locator('.detail-title')).toContainText('failed');
    await page.reload();
    await actor.selectOption('actor-1');
    await page.getByRole('button', { name: /^Meters / }).click();
    await action('Record fresh telemetry'); await save();
    await actor.selectOption('actor-2');
    await page.getByRole('button', { name: /^Outage recovery stages/ }).click();
    await action('Verify recovery telemetry'); await save();
    await expect(page.locator('.detail-title')).toContainText('verified');
    await page.getByRole('button', { name: /^Grid outages/ }).click();
    await action('Restore grid service'); await save();
    await page.reload();
    await page.getByRole('button', { name: /^Grid outages/ }).click();
    await expect(page.locator('.detail-title')).toContainText('restored');
    await page.getByRole('button', { name: /^Energy sites/ }).click();
    await expect(page.locator('.detail-title')).toContainText('online');
});
