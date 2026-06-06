export const MAP_FILE_FORMAT = 'capy-racing-track';
export const MAP_FILE_VERSION = 1;

export function createMapFile( cells, encoded, name = 'Untitled Track' ) {

	return {
		format: MAP_FILE_FORMAT,
		version: MAP_FILE_VERSION,
		name,
		createdAt: new Date().toISOString(),
		encoded,
		cells,
	};

}

export function parseMapFileText( text ) {

	const trimmed = text.trim();
	if ( ! trimmed ) throw new Error( 'Track file is empty' );

	if ( trimmed[ 0 ] !== '{' && trimmed[ 0 ] !== '[' ) {

		return { encoded: trimmed, cells: null };

	}

	const data = JSON.parse( trimmed );

	if ( Array.isArray( data ) ) {

		return { encoded: null, cells: data };

	}

	if ( data.format && data.format !== MAP_FILE_FORMAT ) {

		throw new Error( `Unsupported track file format: ${ data.format }` );

	}

	if ( typeof data.encoded === 'string' ) {

		return { encoded: data.encoded, cells: Array.isArray( data.cells ) ? data.cells : null };

	}

	if ( Array.isArray( data.cells ) ) {

		return { encoded: null, cells: data.cells };

	}

	throw new Error( 'Track file does not contain map data' );

}

export function makeMapFileName( prefix = 'capy-track' ) {

	const stamp = new Date().toISOString()
		.replace( /[:.]/g, '-' )
		.replace( 'T', '-' )
		.slice( 0, 19 );

	return `${ prefix }-${ stamp }.capytrack`;

}
