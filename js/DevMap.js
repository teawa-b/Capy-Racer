import * as THREE from 'three';
import { rigidBody, box, MotionType } from 'crashcat';
import { applyShadowSettings } from './Track.js';

export const DEV_MAP_FORMAT = 'capy-racing-dev-map';
export const DEV_MAP_VERSION = 1;
export const DEV_MAP_STORAGE_KEY = 'capy-racing-dev-map';

export function createEmptyDevMap( name = 'Untitled Dev Map' ) {

	return normalizeDevMap( {
		format: DEV_MAP_FORMAT,
		version: DEV_MAP_VERSION,
		name,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		assets: [],
		objects: [],
		driveAreas: [],
		hitboxes: [],
		waypoints: [],
		start: { x: 0, y: 0, z: 0, rotationY: 0, scale: 1 },
		finish: { x: 0, y: 0, z: 18, rotationY: 0, scale: 1, width: 8 },
	} );

}

export function normalizeDevMap( input = {} ) {

	const map = {
		format: DEV_MAP_FORMAT,
		version: DEV_MAP_VERSION,
		name: typeof input.name === 'string' ? input.name : 'Untitled Dev Map',
		createdAt: input.createdAt || new Date().toISOString(),
		updatedAt: input.updatedAt || new Date().toISOString(),
		assets: Array.isArray( input.assets ) ? input.assets : [],
		objects: Array.isArray( input.objects ) ? input.objects : [],
		driveAreas: Array.isArray( input.driveAreas ) ? input.driveAreas : [],
		hitboxes: Array.isArray( input.hitboxes ) ? input.hitboxes : [],
		waypoints: Array.isArray( input.waypoints ) ? input.waypoints : [],
		start: input.start || { x: 0, y: 0, z: 0, rotationY: 0, scale: 1 },
		finish: input.finish || { x: 0, y: 0, z: 18, rotationY: 0, scale: 1, width: 8 },
	};

	map.assets = map.assets.map( ( asset ) => ( {
		id: String( asset.id ),
		name: asset.name || 'Imported model',
		type: asset.type || 'model/gltf-binary',
		url: asset.url || '',
		dataUrl: asset.dataUrl || '',
	} ) ).filter( asset => asset.id && ( asset.url || asset.dataUrl ) );

	map.objects = map.objects.map( ( object ) => ( {
		id: String( object.id ),
		assetId: String( object.assetId ),
		name: object.name || 'Model',
		position: vec3( object.position, [ object.x || 0, object.y || 0, object.z || 0 ] ),
		rotationY: numberOr( object.rotationY, 0 ),
		scale: numberOr( object.scale, 1 ),
	} ) ).filter( object => object.id && object.assetId );

	map.driveAreas = map.driveAreas.map( normalizeArea );
	map.hitboxes = map.hitboxes.map( normalizeHitbox );
	map.waypoints = map.waypoints.map( normalizePoint );
	map.start = normalizeMarker( map.start, { x: 0, y: 0, z: 0, rotationY: 0, scale: 1 } );
	map.finish = {
		...normalizeMarker( map.finish, { x: 0, y: 0, z: 18, rotationY: 0, scale: 1 } ),
		width: numberOr( map.finish.width, 8 ),
	};

	return map;

}

export function parseDevMapText( text ) {

	const data = JSON.parse( text );
	if ( data.format && data.format !== DEV_MAP_FORMAT ) {

		throw new Error( `Unsupported dev map format: ${ data.format }` );

	}

	return normalizeDevMap( data );

}

export function createDevMapFile( map ) {

	const data = normalizeDevMap( map );
	data.assets = data.assets.map( ( asset ) => {

		const saved = {
			id: asset.id,
			name: asset.name,
			type: asset.type,
		};

		if ( asset.url ) {

			saved.url = asset.url;

		} else if ( asset.dataUrl ) {

			saved.dataUrl = asset.dataUrl;

		}

		return saved;

	} );

	return {
		...data,
		format: DEV_MAP_FORMAT,
		version: DEV_MAP_VERSION,
		updatedAt: new Date().toISOString(),
	};

}

export function makeDevMapFileName( name = 'capy-dev-map' ) {

	const safeName = name.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-|-$/g, '' ) || 'capy-dev-map';
	const stamp = new Date().toISOString()
		.replace( /[:.]/g, '-' )
		.replace( 'T', '-' )
		.slice( 0, 19 );

	return `${ safeName }-${ stamp }.capytrack`;

}

export function loadStoredDevMap() {

	try {

		const raw = localStorage.getItem( DEV_MAP_STORAGE_KEY );
		return raw ? normalizeDevMap( JSON.parse( raw ) ) : null;

	} catch ( e ) {

		console.warn( 'Failed to load stored dev map', e );
		return null;

	}

}

export function storeDevMap( map ) {

	localStorage.setItem( DEV_MAP_STORAGE_KEY, JSON.stringify( createDevMapFile( map ) ) );

}

export async function loadDevMapAssets( loader, map ) {

	const assets = new Map();

	await Promise.all( map.assets.map( async ( asset ) => {

		const gltf = await loader.loadAsync( asset.url || asset.dataUrl );
		gltf.scene.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.material.side = THREE.FrontSide;
				child.frustumCulled = true;

			}

		} );
		assets.set( asset.id, gltf.scene );

	} ) );

	return assets;

}

export function buildDevMapScene( parent, assetScenes, map, options = {} ) {

	const group = new THREE.Group();
	const shadowsEnabled = options.shadows !== false;

	const driveMat = new THREE.MeshStandardMaterial( {
		color: 0x405044,
		roughness: 0.9,
		metalness: 0,
	} );

	for ( const area of map.driveAreas ) {

		const mesh = new THREE.Mesh( new THREE.BoxGeometry( area.width, 0.08, area.depth ), driveMat );
		mesh.position.set( area.x, - 0.08, area.z );
		mesh.rotation.y = area.rotationY;
		mesh.receiveShadow = shadowsEnabled;
		group.add( mesh );

	}

	for ( const object of map.objects ) {

		const src = assetScenes.get( object.assetId );
		if ( ! src ) continue;

		const instance = src.clone();
		instance.position.fromArray( object.position );
		instance.rotation.y = object.rotationY;
		instance.scale.setScalar( object.scale );
		applyShadowSettings( instance, shadowsEnabled );
		group.add( instance );

	}

	parent.add( group );
	return group;

}

export function createDevMapRaceLine( map ) {

	const points = map.waypoints.length >= 2
		? map.waypoints
		: [
			{ x: map.start.x, z: map.start.z },
			{ x: map.finish.x, z: map.finish.z },
		];

	return points.map( ( point, index ) => ( {
		gx: index,
		gz: 0,
		worldX: point.x,
		worldZ: point.z,
		type: index === 0 ? 'track-finish' : 'waypoint',
	} ) );

}

export function computeDevMapBounds( map ) {

	const samples = [
		...map.objects.map( object => ( { x: object.position[ 0 ], z: object.position[ 2 ], pad: 12 * object.scale } ) ),
		...map.driveAreas.map( area => ( { x: area.x, z: area.z, pad: Math.max( area.width, area.depth ) } ) ),
		...map.hitboxes.map( boxArea => ( { x: boxArea.x, z: boxArea.z, pad: Math.max( boxArea.width, boxArea.depth ) } ) ),
		...map.waypoints.map( point => ( { x: point.x, z: point.z, pad: 6 } ) ),
		{ x: map.start.x, z: map.start.z, pad: 8 },
		{ x: map.finish.x, z: map.finish.z, pad: 8 },
	];

	let minX = Infinity, maxX = - Infinity;
	let minZ = Infinity, maxZ = - Infinity;

	for ( const sample of samples ) {

		minX = Math.min( minX, sample.x - sample.pad );
		maxX = Math.max( maxX, sample.x + sample.pad );
		minZ = Math.min( minZ, sample.z - sample.pad );
		maxZ = Math.max( maxZ, sample.z + sample.pad );

	}

	if ( ! Number.isFinite( minX ) ) return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };

	return {
		centerX: ( minX + maxX ) / 2,
		centerZ: ( minZ + maxZ ) / 2,
		halfWidth: Math.max( 10, ( maxX - minX ) / 2 ),
		halfDepth: Math.max( 10, ( maxZ - minZ ) / 2 ),
	};

}

export function computeDevMapSpawn( map ) {

	return {
		position: [ map.start.x, map.start.y + 0.5, map.start.z ],
		angle: map.start.rotationY,
	};

}

export function buildDevMapColliders( world, debugGroup, map ) {

	for ( const area of map.driveAreas ) {

		const position = [ area.x, - 0.125, area.z ];
		const halfExtents = [ area.width / 2, 0.01, area.depth / 2 ];
		const quaternion = yQuaternion( area.rotationY );

		rigidBody.create( world, {
			shape: box.create( { halfExtents } ),
			motionType: MotionType.STATIC,
			objectLayer: world._OL_STATIC,
			position,
			quaternion,
			friction: 5.0,
			restitution: 0.0,
		} );

		if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion, 0x4aff7a );

	}

	for ( const hitbox of map.hitboxes ) {

		const position = [ hitbox.x, hitbox.y, hitbox.z ];
		const halfExtents = [ hitbox.width / 2, hitbox.height / 2, hitbox.depth / 2 ];
		const quaternion = yQuaternion( hitbox.rotationY );

		rigidBody.create( world, {
			shape: box.create( { halfExtents } ),
			motionType: MotionType.STATIC,
			objectLayer: world._OL_STATIC,
			position,
			quaternion,
			friction: 0.0,
			restitution: 0.1,
		} );

		if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion, 0xff4a4a );

	}

}

function normalizeArea( area ) {

	return {
		id: String( area.id ),
		x: numberOr( area.x, 0 ),
		z: numberOr( area.z, 0 ),
		width: Math.max( 0.5, numberOr( area.width, 8 ) ),
		depth: Math.max( 0.5, numberOr( area.depth, 8 ) ),
		rotationY: numberOr( area.rotationY, 0 ),
	};

}

function normalizeHitbox( hitbox ) {

	return {
		id: String( hitbox.id ),
		x: numberOr( hitbox.x, 0 ),
		y: numberOr( hitbox.y, 0.75 ),
		z: numberOr( hitbox.z, 0 ),
		width: Math.max( 0.2, numberOr( hitbox.width, 2 ) ),
		height: Math.max( 0.2, numberOr( hitbox.height, 1.5 ) ),
		depth: Math.max( 0.2, numberOr( hitbox.depth, 2 ) ),
		rotationY: numberOr( hitbox.rotationY, 0 ),
	};

}

function normalizePoint( point ) {

	return {
		id: String( point.id ),
		x: numberOr( point.x, 0 ),
		z: numberOr( point.z, 0 ),
	};

}

function normalizeMarker( marker, fallback ) {

	return {
		x: numberOr( marker.x, fallback.x ),
		y: numberOr( marker.y, fallback.y ),
		z: numberOr( marker.z, fallback.z ),
		rotationY: numberOr( marker.rotationY, fallback.rotationY ),
		scale: Math.max( 0.01, numberOr( marker.scale, fallback.scale ) ),
	};

}

function vec3( value, fallback ) {

	if ( Array.isArray( value ) && value.length >= 3 ) {

		return [
			numberOr( value[ 0 ], fallback[ 0 ] ),
			numberOr( value[ 1 ], fallback[ 1 ] ),
			numberOr( value[ 2 ], fallback[ 2 ] ),
		];

	}

	return fallback;

}

function numberOr( value, fallback ) {

	const number = Number( value );
	return Number.isFinite( number ) ? number : fallback;

}

function yQuaternion( rotationY ) {

	return [ 0, Math.sin( rotationY / 2 ), 0, Math.cos( rotationY / 2 ) ];

}

function addDebugBox( group, halfExtents, position, quaternion, color ) {

	const mat = new THREE.MeshBasicMaterial( { color, wireframe: true } );
	const mesh = new THREE.Mesh( new THREE.BoxGeometry( halfExtents[ 0 ] * 2, halfExtents[ 1 ] * 2, halfExtents[ 2 ] * 2 ), mat );
	mesh.position.fromArray( position );
	mesh.quaternion.fromArray( quaternion );
	group.add( mesh );

}
