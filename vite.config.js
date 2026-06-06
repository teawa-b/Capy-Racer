import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
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

export default defineConfig( {
	publicDir: false,
	build: {
		rollupOptions: {
			input: {
				main: resolve( 'index.html' ),
				editor: resolve( 'editor.html' )
			}
		}
	},
	plugins: [ copyStaticGameAssets() ]
} );
