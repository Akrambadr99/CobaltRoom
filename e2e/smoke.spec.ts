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


test('recovery panel executes persisted stages and resolves active dispatch conflict', async ({page}) => {
 await page.goto('/operations');
 const actor = page.getByRole('combobox',{name:'Current actor'});
 const panel = page.getByRole('region',{name:'Outage recovery sequence'});
 const dialog = page.getByRole('dialog');
 const save = async () => {await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0);};
 await page.getByRole('button',{name:/^Dispatch instructions/}).click();
 await page.getByRole('button',{name:'Activate battery dispatch',exact:true}).click();await save();
 await actor.selectOption('actor-2');await page.getByRole('button',{name:/^Grid outages/}).click();
 await page.getByRole('button',{name:'Create grid outages',exact:true}).click();
 await dialog.getByLabel('Record title',{exact:true}).fill('Campus feeder loss');
 await dialog.getByRole('combobox',{name:'Site',exact:true}).selectOption('site-1');
 await dialog.getByLabel('Outage cause',{exact:true}).fill('Feeder protection trip');await save();
 await panel.getByRole('button',{name:'Run: Acknowledge recovery',exact:true}).click();await save();
 await panel.getByRole('button',{name:'Run: Declare site outage',exact:true}).click();
 await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Stop active battery dispatch');await page.keyboard.press('Escape');
 await actor.selectOption('actor-0');await panel.getByRole('button',{name:/^Stop dispatch:/}).click();
 await dialog.getByLabel('Dispatch stop reason',{exact:true}).fill('Stop dispatch for safe feeder isolation.');await save();
 await actor.selectOption('actor-2');await panel.getByRole('button',{name:'Run: Declare site outage',exact:true}).click();await save();
 await panel.getByRole('button',{name:'Run: Verify recovery telemetry',exact:true}).click();await save();
 await expect(panel).toContainText('Verification failed');await page.reload();
 await expect(panel).toContainText('Verification failed');
 await actor.selectOption('actor-1');await panel.getByRole('button',{name:/^Refresh telemetry:/}).click();await save();
 await actor.selectOption('actor-2');await panel.getByRole('button',{name:'Run: Verify recovery telemetry',exact:true}).click();await save();
 await actor.selectOption('actor-1');await panel.getByRole('button',{name:/^Refresh telemetry:/}).click();await save();
 await actor.selectOption('actor-2');await panel.getByRole('button',{name:'Run: Restore grid service',exact:true}).click();
 await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Telemetry changed');await page.keyboard.press('Escape');
 await panel.getByRole('button',{name:'Run: Verify recovery telemetry',exact:true}).click();await save();
 await panel.getByRole('button',{name:'Run: Restore grid service',exact:true}).click();await save();
 await page.reload();await expect(panel.getByRole('heading')).toContainText('complete');
});

test('acknowledged telemetry alarm persists a bounded controller suppression',async({page})=>{
 await page.goto('/operations');
 const actor=page.getByRole('combobox',{name:'Current actor'});const dialog=page.getByRole('dialog');
 const save=async()=>{await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0);};
 await page.getByRole('button',{name:/^Telemetry alarms/}).click();
 await actor.selectOption('actor-2');await page.getByRole('button',{name:'Acknowledge telemetry alarm',exact:true}).click();await save();
 await actor.selectOption('actor-0');await page.getByRole('button',{name:'Suppress acknowledged alarm',exact:true}).click();
 await dialog.getByLabel('Suppression expiry',{exact:true}).fill('2026-09-14');
 await dialog.getByLabel('Suppression reason',{exact:true}).fill('Meter calibration is already scheduled.');await save();
 await page.reload();await page.getByRole('button',{name:/^Telemetry alarms/}).click();
 await expect(page.locator('.detail-title')).toContainText('suppressed');
 await expect(page.locator('.detail')).toContainText('Meter calibration is already scheduled.');
 await expect(page.locator('.detail')).toContainText('Lina Farouk');
});


test('approved reserve policy persists and blocks conflicting dispatch', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });
    const dialog = page.getByRole('dialog');
    const save = async () => { await dialog.getByRole('button', { name: 'Save command', exact: true }).click();await expect(dialog).toHaveCount(0); };
    await actor.selectOption('actor-1');
    await page.getByRole('button', { name: 'Request reserve change', exact: true }).click();
    await dialog.getByRole('spinbutton', { name: 'Proposed reserve kW', exact: true }).fill('5000');
    await dialog.getByLabel('Reserve justification', { exact: true }).fill('Reserve the complete site envelope for emergency operations.');await save();
    await page.getByRole('button', { name: /^Reserve changes/ }).click();
    await actor.selectOption('actor-0');
    await page.getByRole('button', { name: 'Approve reserve request', exact: true }).click();await save();
    await page.getByRole('button', { name: 'Apply approved reserve', exact: true }).click();await save();
    await page.reload();
    await page.getByRole('button', { name: 'Edit draft', exact: true }).click();
    await expect(dialog.getByRole('spinbutton', { name: 'Required reserve kW', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Dispatch instructions/ }).click();
    await page.getByRole('button', { name: 'Activate battery dispatch', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save command', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('site reserve');
});

test('fresh telemetry and cleared alarms govern restoration', async ({ page }) => {
  await page.goto('/control-room');
  const role = page.getByRole('combobox', { name: 'Control role' });
  await expect(page.getByRole('heading', { name: 'Telemetry, alarm and restoration control' })).toBeVisible();
  await page.getByRole('button', { name: 'Record fresh telemetry' }).click();
  await page.getByRole('button', { name: 'Acknowledge critical alarm' }).click();
  await page.getByRole('button', { name: 'Clear alarm with evidence' }).click();
  await role.selectOption('Field Operator');
  await page.getByRole('button', { name: 'Request restoration' }).click();
  await role.selectOption('Grid Controller');
  await page.getByRole('button', { name: 'Approve restoration' }).click();
  await role.selectOption('Field Operator');
  await page.getByRole('button', { name: 'Execute restoration' }).click();
  await expect(page.getByRole('status')).toContainText('Asset restored');
  await page.reload();
  await expect(page.getByText('Asset online · permit executed')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Control-room history' })).toContainText('restoration-executed');
});
