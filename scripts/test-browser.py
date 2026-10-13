import json
import os
import shutil
import uuid
from playwright.sync_api import sync_playwright

base_url = os.environ.get('GAME_URL', 'http://127.0.0.1:3000').rstrip('/')
expected_host = 'combat-lander-party.chungwu-combat-lander.workers.dev'
room = 'migration-browser-' + str(uuid.uuid4())
with sync_playwright() as p:
    launch = {
        'executable_path': shutil.which('google-chrome') or shutil.which('chromium'),
        'headless': True,
        'args': ['--no-sandbox'],
    }
    if os.environ.get('HTTPS_PROXY'):
        launch['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': 'localhost,127.0.0.1'}
    browser = p.chromium.launch(**launch)
    context_a, context_b = browser.new_context(), browser.new_context()
    a, b = context_a.new_page(), context_b.new_page()
    errors, sockets = [], []
    for page in [a, b]:
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('websocket', lambda socket: sockets.append(socket.url))
        page.goto(base_url + '/' + room, wait_until='networkidle')
    print(json.dumps({'phase':'pages loaded','url':base_url,'errors':errors,'websockets':sockets}), flush=True)

    a.get_by_role('button', name='Start game!', exact=True).click()
    a.get_by_label('Your name').fill('Migration Alice')
    a.get_by_role('button', name='Start!', exact=True).click()
    b.get_by_role('button', name='Join', exact=True).click()
    b.get_by_label('Your name').fill('Migration Bob')
    b.get_by_role('button', name='Join!', exact=True).click()
    a.wait_for_function('globalThis.ENGINE?.game.landers.length === 2')
    b.wait_for_function('globalThis.ENGINE?.game.landers.length === 2')

    a.keyboard.down('ArrowUp')
    a.wait_for_timeout(300)
    a.keyboard.up('ArrowUp')
    b.wait_for_function('ENGINE.playerInputs.some(m => m.event.type === "thrust")')
    a.get_by_role('button', name='q', exact=True).click()
    b.wait_for_function('ENGINE.playerInputs.some(m => m.event.type === "fire-rocket")')

    chat = 'Live PartyServer browser test ' + str(uuid.uuid4())[:8]
    a.get_by_role('button', name='Chat', exact=True).click()
    a.get_by_role('textbox', name='Message', exact=True).fill(chat)
    a.get_by_role('button', name='Send', exact=True).click()
    b.wait_for_function('(message) => document.body.innerText.includes(message)', arg=chat)

    state = '({id:ENGINE.game.id,time:ENGINE.timestep,players:ENGINE.game.landers.map(l=>l.name),canvas:document.querySelectorAll("canvas").length})'
    sa, sb = a.evaluate(state), b.evaluate(state)
    assert sa['id'] == sb['id']
    assert sorted(sa['players']) == ['Migration Alice', 'Migration Bob']
    assert sorted(sb['players']) == ['Migration Alice', 'Migration Bob']
    assert sa['canvas'] == 1 and sb['canvas'] == 1
    assert all(expected_host in socket for socket in sockets), sockets
    assert not errors, errors
    a.screenshot(path='/tmp/combat-lander-live-browser.png')
    print(json.dumps({'status':'PASS','url':base_url,'alice':sa,'bob':sb,'websockets':sockets,'browser_errors':errors,'checks':['start','join','flight input','rocket input','chat','canvas','live Worker routing']}))
    browser.close()
