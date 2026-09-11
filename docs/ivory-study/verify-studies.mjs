// Playwright is not a dependency of this repository: point PLAYWRIGHT_MODULE at an
// installed playwright's index.mjs and CHROMIUM_EXECUTABLE at a Chromium binary.
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
const chromiumExecutable = process.env.CHROMIUM_EXECUTABLE;
if (!playwrightModule || !chromiumExecutable) throw new Error('Set PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE to run the study verification.');
const { chromium } = await import(playwrightModule);
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = import.meta.dirname;
const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable, args: ['--mute-audio'] });
const receipts = [];
try {
  for (const id of ['ivory','obsidian']) {
    const errors=[];
    const page=await browser.newPage({viewport:{width:1024,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    const fragment=await readFile(`${dir}/pulsar-${id}.html`,'utf8');
    await page.setContent(`<html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#f1f1ed;padding:0}</style>${fragment}</html>`);
    for (const mode of ['live','tracker']) {
      await page.setViewportSize({width:1024,height:1000});
      await page.locator(`[data-mode="${mode}"]`).click();
      for(const width of [1024,736,390,320]) {
        await page.setViewportSize({width,height:1000});
        await page.screenshot({path:`${dir}/${id}-${mode}-${width}.png`,fullPage:true});
        const measure=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,headings:document.querySelectorAll('.ps-pattern th').length,trackerVisible:!document.querySelector('.ps-tracker').hidden,keyboardTop:Math.round(document.querySelector('.ps-keybed').getBoundingClientRect().top)}));
        assert.ok(measure.scroll<=width,`${id}/${mode}/${width} horizontal overflow ${measure.scroll}`);
        if(width<720) assert.equal(measure.trackerVisible,false);
        if(width<=390) assert.ok(measure.keyboardTop<500, 'Phone keyboard must be immediately reachable');
        receipts.push({id,mode,...measure});
      }
    }
    await page.setViewportSize({width:1024,height:1000});
    assert.equal(await page.locator('.ps-song option').count(),8);
    assert.equal(await page.locator('.ps-pattern th').count(),6);
    assert.equal(await page.locator('.ps-bpm').textContent(),'108');
    await page.locator('.ps-tempo').fill('160');
    await page.locator('.ps-tempo').dispatchEvent('change');
    assert.equal(await page.locator('.ps-bpm').textContent(),'120');
    await page.locator('.ps-undo').click();
    assert.equal(await page.locator('.ps-bpm').textContent(),'108');
    await page.locator('[data-cell="0,1"]').click();
    await page.locator('.ps-edit').click();
    await page.locator('[data-note="2"]').click();
    assert.match(await page.locator('[data-cell="0,1"]').textContent(),/D-4/);
    await page.locator('.ps-undo').click();
    assert.doesNotMatch(await page.locator('[data-cell="0,1"]').textContent(),/D-4/);
    await page.locator('.ps-next').click();
    assert.match(await page.locator('.ps-row-range').textContent(),/^08/);
    await page.locator('[data-macro="duty"]').click();
    assert.equal(await page.locator('[data-macro="duty"]').getAttribute('aria-pressed'),'true');
    await page.locator('.ps-song select').selectOption('7');
    assert.match(await page.locator('.ps-song select option:checked').textContent(),/Breakwater/);
    await page.locator('.ps-play').click();
    assert.equal(await page.locator('.ps-play').getAttribute('aria-pressed'),'true');
    await page.locator('[data-mode="live"]').click();
    assert.equal(await page.locator('[data-param="duty"]').isDisabled(),true);
    await page.locator('.ps-play').click();
    assert.equal(await page.locator('[data-param="duty"]').isDisabled(),false);
    await page.locator('[data-param="duty"]').fill('0');
    assert.match(await page.locator('.ps-wave').getAttribute('aria-label'),/12.5/);
    assert.deepEqual(errors,[]);
    receipts.push({id,interactionChecks:'passed',errors});
    await page.close();
  }
  await writeFile(`${dir}/verification.json`,JSON.stringify(receipts,null,2)+'\n');
  console.log('Both candidates: 16 layout checks and interaction journeys passed.');
} finally { await browser.close(); }
