import{expect,test}from'@playwright/test';test('GridLoom exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'GridLoom command center'})).toBeVisible();await page.getByRole('link',{name:'Operations',exact:true}).click();const telemetry=page.getByRole('region',{name:'Telemetry investigation'});await telemetry.getByRole('textbox',{name:'Search telemetry'}).fill('no-match-fixture');await expect(telemetry).toContainText('No telemetry matches both filters.');await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

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

test('forecast-pinned reserve becomes active after assignment and custody acceptance',async({page})=>{await page.goto('/dispatch-control');const role=page.getByLabel('Dispatch-control role');await page.getByRole('button',{name:'Request reserve schedule'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Approve reserve schedule'}).click();await role.selectOption('Dispatcher');await page.getByRole('button',{name:'Assign battery commitment'}).click();await role.selectOption('Field Operator');await page.getByRole('button',{name:'Accept dispatch custody'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Activate reserve dispatch'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Reserve schedule'}).locator('xpath=ancestor::section')).toContainText('active · 80 MWh');await expect(page.getByRole('region',{name:'Dispatch-control history'})).toContainText('dispatch-activated')});

test('shift handoff transfers asset and live dispatch custody',async({page})=>{await page.goto('/asset-operations');await page.getByRole('button',{name:'Begin operator handoff'}).click();await page.getByRole('button',{name:'Accept operator handoff'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Shift handoff'}).locator('xpath=ancestor::section')).toContainText('accepted · custodian field-c');await expect(page.getByRole('region',{name:'Asset-operations history'})).toContainText('handoff-accepted')});

test('alarm investigation closes after contained and freshly verified recovery',async({page})=>{await page.goto('/incident-investigation');const role=page.getByLabel('Incident-investigation role');await page.getByRole('button',{name:'Open alarm investigation'}).click();await page.getByRole('button',{name:'Record root cause'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Approve containment'}).click();await role.selectOption('Field Operator');await page.getByRole('button',{name:'Execute field recovery'}).click();await page.getByRole('button',{name:'Refresh recovery telemetry'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Verify incident recovery'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Recovery verification'}).locator('xpath=ancestor::section')).toContainText('closed · 1 attempt');await expect(page.getByRole('region',{name:'Incident-investigation history'})).toContainText('recovery-verified')});
test('priority load shed restores only after fresh recovery telemetry',async({page})=>{await page.goto('/load-shed-control');const role=page.getByRole('combobox',{name:'Load-shed role'});await page.getByRole('button',{name:'Draft load shed'}).click();await role.selectOption('Shift Supervisor');await page.getByRole('button',{name:'Approve load shed'}).click();await role.selectOption('Grid Operator');await page.getByRole('button',{name:'Shed next feeder'}).click();await role.selectOption('Reliability Engineer');await page.getByRole('button',{name:'Refresh recovery telemetry'}).click();await role.selectOption('Grid Operator');await page.getByRole('button',{name:'Restore next feeder'}).click();await page.reload();await expect(page.getByText(/restored · telemetry 8 · 0 shed/)).toBeVisible();await expect(page.getByRole('list',{name:'Load shed history'})).toContainText('feeder-restored-feeder-c')});
test('engineered restoration refreshes telemetry between ordered switching stages',async({page})=>{await page.goto('/restoration-dossier');const role=page.getByRole('combobox',{name:'Restoration role'});await page.getByRole('button',{name:'Open restoration dossier'}).click();await role.selectOption('Reliability Engineer');await page.getByRole('button',{name:'Engineer switching sequence'}).click();await page.getByRole('button',{name:'Refresh restoration telemetry'}).click();await role.selectOption('Shift Supervisor');await page.getByRole('button',{name:'Approve restoration'}).click();await role.selectOption('Field Operator');await page.getByRole('button',{name:'Execute next switching stage'}).click();await role.selectOption('Reliability Engineer');await page.getByRole('button',{name:'Refresh restoration telemetry'}).click();await role.selectOption('Field Operator');await page.getByRole('button',{name:'Execute next switching stage'}).click();await role.selectOption('Reliability Engineer');await page.getByRole('button',{name:'Refresh restoration telemetry'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Verify network restoration'}).click();await expect(page.getByRole('status')).toContainText('verified');await page.reload();await expect(page.getByText(/restored · alarm cleared · 18 MW affected/)).toBeVisible();await expect(page.getByRole('region',{name:'Restoration dossier history'})).toContainText('restoration-verified')});
test('planned outage restores an independently maintained and protection-tested asset',async({page})=>{await page.goto('/planned-outage');const role=page.getByRole('combobox',{name:'Outage role'});await page.getByRole('button',{name:'Plan maintenance outage'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Approve planned outage'}).click();await role.selectOption('Field Operator');await page.getByRole('button',{name:'Isolate planned asset'}).click();await role.selectOption('Maintenance Lead');await page.getByRole('button',{name:'Complete planned maintenance'}).click();await role.selectOption('Protection Engineer');await page.getByRole('button',{name:'Record protection return test'}).click();await role.selectOption('Grid Controller');await page.getByRole('button',{name:'Restore maintained asset'}).click();await page.reload();await expect(page.getByText(/energized · version 11 · outage restored/)).toBeVisible();await expect(page.getByText(/telemetry fresh r21/)).toBeVisible();await expect(page.getByRole('list',{name:'Planned outage history'})).toContainText('planned-outage-restored')});

test('energizes an approved generator interconnection',async({page})=>{await page.goto('/interconnection-control');await page.getByRole('button',{name:'Complete capacity study'}).click();await page.getByLabel('Interconnection role').selectOption('Protection Engineer');await page.getByRole('button',{name:'Verify protection'}).click();await page.getByLabel('Interconnection role').selectOption('Compliance Officer');await page.getByRole('button',{name:'Approve energization'}).click();await page.getByLabel('Interconnection role').selectOption('Control Operator');await page.getByRole('button',{name:'Energize generator'}).click();await expect(page.getByRole('status')).toContainText('Generator energized');});

test('dispatches and settles battery flexibility',async({page})=>{await page.goto('/flexibility-market');await page.getByRole('button',{name:'Draft flexibility commitment'}).click();await page.getByLabel('Flexibility role').selectOption('Asset Controller');await page.getByRole('button',{name:'Reserve battery capacity'}).click();await page.getByLabel('Flexibility role').selectOption('Market Approver');await page.getByRole('button',{name:'Approve market offer'}).click();await page.getByLabel('Flexibility role').selectOption('Dispatch Operator');await page.getByRole('button',{name:'Dispatch flexibility'}).click();await page.getByRole('button',{name:'Record delivery telemetry'}).click();await page.getByLabel('Flexibility role').selectOption('Settlement Reviewer');await page.getByRole('button',{name:'Verify settlement'}).click();await expect(page.getByRole('status')).toContainText('Flexibility settlement verified');});

test('isolates field work and safely re-energizes the asset',async({page})=>{await page.goto('/switching-permits');const role=page.getByLabel('Permit role');await page.getByRole('button',{name:'Draft switching permit'}).click();await role.selectOption('Safety Reviewer');await page.getByRole('button',{name:'Review switching sequence'}).click();await role.selectOption('Control Operator');await page.getByRole('button',{name:'Isolate and lock asset'}).click();await role.selectOption('Field Lead');await page.getByRole('button',{name:'Accept field permit'}).click();await page.getByRole('button',{name:'Complete field work'}).click();await role.selectOption('Control Operator');await page.getByRole('button',{name:'Close and energize'}).click();await expect(page.getByRole('status')).toContainText('Permit closed and asset energized');await expect(page.getByText(/TX-204 · service/)).toBeVisible();});
