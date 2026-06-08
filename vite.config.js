import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { defineConfig } from 'vite';

const assetDirs = [ 'audio', 'models', 'sprites' ];

function copyStaticGameAssets() {
	return {
		name: 'copy-static-game-assets',
		closeBundle() {
			const outDir = resolve( 'dist' );
			mkdirSync( outDir, { recursive: true } );

			for ( const dir of assetDirs ) {
				const from = resolve( dir );
				const to = resolve( outDir, dir );

				if ( ! existsSync( from ) ) continue;

				rmSync( to, { recursive: true, force: true } );
				cpSync( from, to, { recursive: true } );
			}
		}
	};
}

function devMapAssetServer() {
	const assetRoots = [ 'models/dev', 'models/dev-imports' ];

	return {
		name: 'dev-map-asset-server',
		configureServer( server ) {
			server.middlewares.use( '/__dev-map/assets', ( req, res ) => {
				if ( req.method !== 'GET' ) {
					res.statusCode = 405;
					res.end();
					return;
				}

				const assets = [];
				for ( const root of assetRoots ) {
					const absRoot = resolve( root );
					if ( ! existsSync( absRoot ) ) continue;

					for ( const entry of readdirSync( absRoot, { withFileTypes: true } ) ) {
						if ( ! entry.isFile() || ! /\.(glb|gltf)$/i.test( entry.name ) ) continue;

						const url = `/${ root.replace( /\\/g, '/' ) }/${ entry.name }`;
						assets.push( {
							id: url,
							name: entry.name,
							type: entry.name.toLowerCase().endsWith( '.gltf' ) ? 'model/gltf+json' : 'model/gltf-binary',
							url,
						} );
					}
				}

				res.setHeader( 'Content-Type', 'application/json' );
				res.end( JSON.stringify( { assets } ) );
			} );

			server.middlewares.use( '/__dev-map/upload-model', ( req, res ) => {
				if ( req.method !== 'POST' ) {
					res.statusCode = 405;
					res.end();
					return;
				}

				const rawName = String( req.headers[ 'x-file-name' ] || 'model.glb' );
				const ext = extname( rawName ).toLowerCase();
				if ( ext !== '.glb' && ext !== '.gltf' ) {
					res.statusCode = 400;
					res.end( JSON.stringify( { error: 'Only .glb and .gltf files are supported' } ) );
					return;
				}

				const safeBase = rawName
					.replace( /\.[^.]+$/, '' )
					.toLowerCase()
					.replace( /[^a-z0-9]+/g, '-' )
					.replace( /^-|-$/g, '' ) || 'model';
				const fileName = `${ safeBase }-${ Date.now().toString( 36 ) }${ ext }`;
				const outDir = resolve( 'models/dev-imports' );
				const outFile = join( outDir, fileName );
				const chunks = [];

				req.on( 'data', chunk => chunks.push( chunk ) );
				req.on( 'end', () => {
					mkdirSync( outDir, { recursive: true } );
					writeFileSync( outFile, Buffer.concat( chunks ) );
					const url = `/models/dev-imports/${ fileName }`;
					res.setHeader( 'Content-Type', 'application/json' );
					res.end( JSON.stringify( {
						asset: {
							id: url,
							name: rawName,
							type: ext === '.gltf' ? 'model/gltf+json' : 'model/gltf-binary',
							url,
						}
					} ) );
				} );
			} );
		}
	};
}

export default defineConfig( {
	publicDir: false,
	build: {
		rollupOptions: {
			input: {
				main: resolve( 'index.html' ),
				editor: resolve( 'editor.html' ),
				devEditor: resolve( 'dev-editor.html' )
			}
		}
	},
	plugins: [ devMapAssetServer(), copyStaticGameAssets() ]
} );
