const test = require('ava')
const createTestServer = require('create-test-server')
const {readFileSync} = require('fs')
const {resolve} = require('path')

const extractCss = require('..')

let server
const fixture = readFileSync(resolve(__dirname, 'fixture.css'), 'utf8')

test.before(async () => {
	server = await createTestServer()

	server.get('/fixture.css', (req, res) => {
		res.send(fixture)
	})
})

test.after(async () => {
	await server.close()
})

test('it fetches css from a page with CSS in a server generated <link> inside the <head>', async t => {
	const url = '/server-link-head'
	server.get(url, (req, res) => {
		res.send(`
			<!doctype html>
			<html>
				<head>
					<link rel="stylesheet" href="fixture.css" />
				</head>
			</html>
		`)
	})

	const actual = await extractCss(server.url + url)
	const expected = fixture

	t.is(actual, expected)
})

test('it fetches css from a page with CSS in server generated <style> inside the <head>', async t => {
	const url = '/server-style-head'
	server.get(url, (req, res) => {
		res.send(`
			<!doctype html>
			<style>${fixture}</style>
		`)
	})

	const actual = await extractCss(server.url + url)
	const expected = 'body { color: teal; }'

	t.is(actual, expected)
})

test('it finds JS generated <link /> CSS', async t => {
	const path = '/js-generated-link'
	const cssInJsExampleHtml = readFileSync(
		resolve(__dirname, 'js-create-link-element.html'),
		'utf8'
	)

	server.get(path, (req, res) => {
		res.send(cssInJsExampleHtml)
	})

	const actual = await extractCss(server.url + path)
	const expected = fixture

	t.is(actual, expected)
})

test('it finds JS generated <style /> CSS', async t => {
	const url = '/js-generated-js-style-tag'
	const cssInJsExampleHtml = readFileSync(
		resolve(__dirname, 'js-create-style-element.html'),
		'utf8'
	)
	server.get(url, (req, res) => {
		res.send(cssInJsExampleHtml)
	})

	const actual = await extractCss(server.url + url, {waitUntil: 'load'})
	const expected = 'body { color: teal; }'

	t.is(actual, expected)
})

test('it finds css-in-js, like Styled Components', async t => {
	const url = '/css-in-js'
	const cssInJsExampleHtml = readFileSync(
		resolve(__dirname, 'css-in-js.html'),
		'utf8'
	)
	server.get(url, (req, res) => {
		res.send(cssInJsExampleHtml)
	})

	const actual = await extractCss(server.url + url, {waitUntil: 'load'})
	// Color is RGB instead of Hex, because of serialization:
	// https://www.w3.org/TR/cssom-1/#serializing-css-values
	const expected =
		'html { color: rgb(255, 0, 0); }.hJHBhT { color: blue; font-family: sans-serif; font-size: 3em; }'

	t.is(actual, expected)
})

test('it combines server generated <link> and <style> tags with client side created <link> and <style> tags', async t => {
	const path = '/kitchen-sink'
	const kitchenSinkExample = readFileSync(
		resolve(__dirname, 'kitchen-sink.html'),
		'utf8'
	)
	server.get(path, (req, res) => {
		res.send(kitchenSinkExample)
	})

	const actual = await extractCss(server.url + path)

	t.true(actual.includes('content: "js-style";'))
	t.true(actual.includes('content: "server-style";'))
	t.true(actual.includes('body {'))
	t.true(actual.includes('color: teal;'))
	t.snapshot(actual)
})

test('it rejects if the url has an HTTP error status', async t => {
	const urlWith404 = server.url + '/404-page'
	await t.throwsAsync(extractCss(urlWith404), {
		message: `There was an error retrieving CSS from ${urlWith404}.\n\tHTTP status code: 404 (Not Found)`
	})
})

test('it rejects on an invalid url', async t => {
	await t.throwsAsync(extractCss('site.example'))
})
