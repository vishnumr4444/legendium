import * as THREE from 'three';
import {
	BufferGeometry,
	DynamicDrawUsage,
	Float32BufferAttribute,
	MathUtils,
	Uint32BufferAttribute,
	Vector3
} from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

/**
 * Creates a lightning strike geometry that can be used to create lightning effects
 * @param {Object} params - Configuration parameters for the lightning strike
 * @returns {LightningStrike} A new LightningStrike instance
 */
export function createLightningStrike(params = {}) {
	return new LightningStrike(params);
}

/**
 * Creates multiple lightning strikes between objects
 * @param {Array} connections - Array of {source, target, params} objects
 * @returns {Array} Array of lightning strike objects
 */
export function createLightningStrikes(connections) {
	return connections.map(conn => {
		const params = {
			sourceOffset: conn.source,
			destOffset: conn.target,
			...conn.params
		};
		return createLightningStrike(params);
	});
}

/**
 * Updates multiple lightning strikes with new source and target positions
 * @param {Array} strikes - Array of lightning strike objects
 * @param {Array} connections - Array of {source, target} objects
 * @param {number} time - Current time for animation
 */
export function updateLightningStrikes(strikes, connections, time) {
	strikes.forEach((strike, index) => {
		const conn = connections[index];
		if (conn && conn.source && conn.target) {
			strike.rayParameters.sourceOffset.copy(conn.source);
			strike.rayParameters.destOffset.copy(conn.target);
			strike.update(time);
		}
	});
}

/**
 * Default lightning parameters
 * Thickness of lightning rays is controlled by radius0 and radius1 parameters
 */
export const DEFAULT_LIGHTNING_PARAMS = {
	radius0: 0.02,
	radius1: 0.02,
	minRadius: 0.005,
	maxIterations: 7,
	isEternal: true,
	timeScale: 0.7,
	propagationTimeFactor: 0.05,
	vanishingTimeFactor: 0.95,
	subrayPeriod: 2.5,
	subrayDutyCycle: 0.3,
	maxSubrayRecursion: 3,
	ramification: 7,
	recursionProbability: 0.6,
	roughness: 0.85,
	straightness: 0.68
};

/**
 * LightningStrike object for creating lightning strikes and voltaic arcs.
 */
class LightningStrike extends BufferGeometry {

	constructor(rayParameters = {}) {
		super();

		this.isLightningStrike = true;
		this.type = 'LightningStrike';

		// Set parameters, and set undefined parameters to default values
		this.init(LightningStrike.copyParameters(rayParameters, rayParameters));

		// Creates and populates the mesh
		this.createMesh();
	}

	static createRandomGenerator() {
		const numSeeds = 2053;
		const seeds = [];

		for (let i = 0; i < numSeeds; i++) {
			seeds.push(Math.random());
		}

		const generator = {
			currentSeed: 0,

			random: function () {
				const value = seeds[generator.currentSeed];
				generator.currentSeed = (generator.currentSeed + 1) % numSeeds;
				return value;
			},

			getSeed: function () {
				return generator.currentSeed / numSeeds;
			},

			setSeed: function (seed) {
				generator.currentSeed = Math.floor(seed * numSeeds) % numSeeds;
			}
		};

		return generator;
	}

	static copyParameters(dest = {}, source = {}) {
		const vecCopy = function (v) {
			if (source === dest) {
				return v;
			} else {
				return v.clone();
			}
		};

		dest.sourceOffset = source.sourceOffset !== undefined ? vecCopy(source.sourceOffset) : new Vector3(0, 100, 0);
		dest.destOffset = source.destOffset !== undefined ? vecCopy(source.destOffset) : new Vector3(0, 0, 0);

		dest.timeScale = source.timeScale !== undefined ? source.timeScale : 1;
		dest.roughness = source.roughness !== undefined ? source.roughness : 0.9;
		dest.straightness = source.straightness !== undefined ? source.straightness : 0.7;

		dest.up0 = source.up0 !== undefined ? vecCopy(source.up0) : new Vector3(0, 0, 1);
		dest.up1 = source.up1 !== undefined ? vecCopy(source.up1) : new Vector3(0, 0, 1);
		dest.radius0 = source.radius0 !== undefined ? source.radius0 : 1;
		dest.radius1 = source.radius1 !== undefined ? source.radius1 : 1;
		dest.radius0Factor = source.radius0Factor !== undefined ? source.radius0Factor : 0.5;
		dest.radius1Factor = source.radius1Factor !== undefined ? source.radius1Factor : 0.2;
		dest.minRadius = source.minRadius !== undefined ? source.minRadius : 0.2;

		// These parameters should not be changed after lightning creation. They can be changed but the ray will change its form abruptly:
		dest.isEternal = source.isEternal !== undefined ? source.isEternal : (source.birthTime === undefined || source.deathTime === undefined);
		dest.birthTime = source.birthTime;
		dest.deathTime = source.deathTime;
		dest.propagationTimeFactor = source.propagationTimeFactor !== undefined ? source.propagationTimeFactor : 0.1;
		dest.vanishingTimeFactor = source.vanishingTimeFactor !== undefined ? source.vanishingTimeFactor : 0.9;
		dest.subrayPeriod = source.subrayPeriod !== undefined ? source.subrayPeriod : 4;
		dest.subrayDutyCycle = source.subrayDutyCycle !== undefined ? source.subrayDutyCycle : 0.6;

		// These parameters cannot change after lightning creation:
		dest.maxIterations = source.maxIterations !== undefined ? source.maxIterations : 9;
		dest.isStatic = source.isStatic !== undefined ? source.isStatic : false;
		dest.ramification = source.ramification !== undefined ? source.ramification : 5;
		dest.maxSubrayRecursion = source.maxSubrayRecursion !== undefined ? source.maxSubrayRecursion : 3;
		dest.recursionProbability = source.recursionProbability !== undefined ? source.recursionProbability : 0.6;
		dest.generateUVs = source.generateUVs !== undefined ? source.generateUVs : false;
		dest.randomGenerator = source.randomGenerator;
		dest.noiseSeed = source.noiseSeed;
		dest.onDecideSubrayCreation = source.onDecideSubrayCreation;
		dest.onSubrayCreation = source.onSubrayCreation;

		return dest;
	}

	update(time) {
		if (this.isStatic) return;

		if (this.rayParameters.isEternal || (this.rayParameters.birthTime <= time && time <= this.rayParameters.deathTime)) {
			this.updateMesh(time);

			if (time < this.subrays[0].endPropagationTime) {
				this.state = LightningStrike.RAY_PROPAGATING;
			} else if (time > this.subrays[0].beginVanishingTime) {
				this.state = LightningStrike.RAY_VANISHING;
			} else {
				this.state = LightningStrike.RAY_STEADY;
			}

			this.visible = true;
		} else {
			this.visible = false;

			if (time < this.rayParameters.birthTime) {
				this.state = LightningStrike.RAY_UNBORN;
			} else {
				this.state = LightningStrike.RAY_EXTINGUISHED;
			}
		}
	}

	init(rayParameters) {
		// Init all the state from the parameters
		this.rayParameters = rayParameters;

		// These parameters cannot change after lightning creation:
		this.maxIterations = rayParameters.maxIterations !== undefined ? Math.floor(rayParameters.maxIterations) : 9;
		rayParameters.maxIterations = this.maxIterations;
		this.isStatic = rayParameters.isStatic !== undefined ? rayParameters.isStatic : false;
		rayParameters.isStatic = this.isStatic;
		this.ramification = rayParameters.ramification !== undefined ? Math.floor(rayParameters.ramification) : 5;
		rayParameters.ramification = this.ramification;
		this.maxSubrayRecursion = rayParameters.maxSubrayRecursion !== undefined ? Math.floor(rayParameters.maxSubrayRecursion) : 3;
		rayParameters.maxSubrayRecursion = this.maxSubrayRecursion;
		this.recursionProbability = rayParameters.recursionProbability !== undefined ? rayParameters.recursionProbability : 0.6;
		rayParameters.recursionProbability = this.recursionProbability;
		this.generateUVs = false; // Removed UV generation support
		rayParameters.generateUVs = false;

		// Random generator
		if (rayParameters.randomGenerator !== undefined) {
			this.randomGenerator = rayParameters.randomGenerator;
			this.seedGenerator = rayParameters.randomGenerator;

			if (rayParameters.noiseSeed !== undefined) {
				this.seedGenerator.setSeed(rayParameters.noiseSeed);
			}
		} else {
			this.randomGenerator = LightningStrike.createRandomGenerator();
			this.seedGenerator = Math;
		}

		// Ray creation callbacks
		if (rayParameters.onDecideSubrayCreation !== undefined) {
			this.onDecideSubrayCreation = rayParameters.onDecideSubrayCreation;
		} else {
			this.createDefaultSubrayCreationCallbacks();

			if (rayParameters.onSubrayCreation !== undefined) {
				this.onSubrayCreation = rayParameters.onSubrayCreation;
			}
		}

		// Internal state
		this.state = LightningStrike.RAY_INITIALIZED;

		this.maxSubrays = Math.ceil(1 + Math.pow(this.ramification, Math.max(0, this.maxSubrayRecursion - 1)));
		rayParameters.maxSubrays = this.maxSubrays;

		this.maxRaySegments = 2 * (1 << this.maxIterations);

		this.subrays = [];
		for (let i = 0; i < this.maxSubrays; i++) {
			this.subrays.push(this.createSubray());
		}

		this.raySegments = [];
		for (let i = 0; i < this.maxRaySegments; i++) {
			this.raySegments.push(this.createSegment());
		}

		this.time = 0;
		this.timeFraction = 0;
		this.currentSegmentCallback = null;
		this.currentCreateTriangleVertices = this.createTriangleVerticesWithoutUVs; // Simplified to only use non-UV version
		this.numSubrays = 0;
		this.currentSubray = null;
		this.currentSegmentIndex = 0;
		this.isInitialSegment = false;
		this.subrayProbability = 0;

		this.currentVertex = 0;
		this.currentIndex = 0;
		this.currentCoordinate = 0;
		this.currentUVCoordinate = 0;
		this.vertices = null;
		this.uvs = null;
		this.indices = null;
		this.positionAttribute = null;
		this.uvsAttribute = null;

		this.simplexX = new SimplexNoise(this.seedGenerator);
		this.simplexY = new SimplexNoise(this.seedGenerator);
		this.simplexZ = new SimplexNoise(this.seedGenerator);

		// Temp vectors
		this.forwards = new Vector3();
		this.forwardsFill = new Vector3();
		this.side = new Vector3();
		this.down = new Vector3();
		this.middlePos = new Vector3();
		this.middleLinPos = new Vector3();
		this.newPos = new Vector3();
		this.vPos = new Vector3();
		this.cross1 = new Vector3();
	}

	createMesh() {
		const maxDrawableSegmentsPerSubRay = 1 << this.maxIterations;
		const maxVerts = 3 * (maxDrawableSegmentsPerSubRay + 1) * this.maxSubrays;
		const maxIndices = 18 * maxDrawableSegmentsPerSubRay * this.maxSubrays;

		this.vertices = new Float32Array(maxVerts * 3);
		this.indices = new Uint32Array(maxIndices);

		// Populate the mesh
		this.fillMesh(0);

		this.setIndex(new Uint32BufferAttribute(this.indices, 1));
		this.positionAttribute = new Float32BufferAttribute(this.vertices, 3);
		this.setAttribute('position', this.positionAttribute);

		if (!this.isStatic) {
			this.index.usage = DynamicDrawUsage;
			this.positionAttribute.usage = DynamicDrawUsage;
		}

		// Store buffers for later modification
		this.vertices = this.positionAttribute.array;
		this.indices = this.index.array;
	}

	updateMesh(time) {
		this.fillMesh(time);
		this.drawRange.count = this.currentIndex;
		this.index.needsUpdate = true;
		this.positionAttribute.needsUpdate = true;
	}

	fillMesh(time) {
		const scope = this;

		this.currentVertex = 0;
		this.currentIndex = 0;
		this.currentCoordinate = 0;
		this.currentUVCoordinate = 0;

		this.fractalRay(time, function fillVertices(segment) {
			const subray = scope.currentSubray;

			if (time < subray.birthTime) {
				return;
			} else if (scope.rayParameters.isEternal && scope.currentSubray.recursion == 0) {
				// Eternal rays don't propagate nor vanish, but its subrays do
				scope.createPrism(segment);
				scope.onDecideSubrayCreation(segment, scope);
			} else if (time < subray.endPropagationTime) {
				if (scope.timeFraction >= segment.fraction0 * subray.propagationTimeFactor) {
					// Ray propagation has arrived to this segment
					scope.createPrism(segment);
					scope.onDecideSubrayCreation(segment, scope);
				}
			} else if (time < subray.beginVanishingTime) {
				// Ray is steady (nor propagating nor vanishing)
				scope.createPrism(segment);
				scope.onDecideSubrayCreation(segment, scope);
			} else {
				if (scope.timeFraction <= subray.vanishingTimeFactor + segment.fraction1 * (1 - subray.vanishingTimeFactor)) {
					// Segment has not yet vanished
					scope.createPrism(segment);
				}
				scope.onDecideSubrayCreation(segment, scope);
			}
		});
	}

	addNewSubray() {
		return this.subrays[this.numSubrays++];
	}

	initSubray(subray, rayParameters) {
		subray.pos0.copy(rayParameters.sourceOffset);
		subray.pos1.copy(rayParameters.destOffset);
		subray.up0.copy(rayParameters.up0);
		subray.up1.copy(rayParameters.up1);
		subray.radius0 = rayParameters.radius0;
		subray.radius1 = rayParameters.radius1;
		subray.birthTime = rayParameters.birthTime;
		subray.deathTime = rayParameters.deathTime;
		subray.timeScale = rayParameters.timeScale;
		subray.roughness = rayParameters.roughness;
		subray.straightness = rayParameters.straightness;
		subray.propagationTimeFactor = rayParameters.propagationTimeFactor;
		subray.vanishingTimeFactor = rayParameters.vanishingTimeFactor;

		subray.maxIterations = this.maxIterations;
		subray.seed = rayParameters.noiseSeed !== undefined ? rayParameters.noiseSeed : 0;
		subray.recursion = 0;
	}

	fractalRay(time, segmentCallback) {
		this.time = time;
		this.currentSegmentCallback = segmentCallback;
		this.numSubrays = 0;

		// Add the top level subray
		this.initSubray(this.addNewSubray(), this.rayParameters);

		// Process all subrays that are being generated until consuming all of them
		for (let subrayIndex = 0; subrayIndex < this.numSubrays; subrayIndex++) {
			const subray = this.subrays[subrayIndex];
			this.currentSubray = subray;

			this.randomGenerator.setSeed(subray.seed);

			subray.endPropagationTime = MathUtils.lerp(subray.birthTime, subray.deathTime, subray.propagationTimeFactor);
			subray.beginVanishingTime = MathUtils.lerp(subray.deathTime, subray.birthTime, 1 - subray.vanishingTimeFactor);

			const random1 = this.randomGenerator.random;
			subray.linPos0.set(random1(), random1(), random1()).multiplyScalar(1000);
			subray.linPos1.set(random1(), random1(), random1()).multiplyScalar(1000);

			this.timeFraction = (time - subray.birthTime) / (subray.deathTime - subray.birthTime);

			this.currentSegmentIndex = 0;
			this.isInitialSegment = true;

			const segment = this.getNewSegment();
			segment.iteration = 0;
			segment.pos0.copy(subray.pos0);
			segment.pos1.copy(subray.pos1);
			segment.linPos0.copy(subray.linPos0);
			segment.linPos1.copy(subray.linPos1);
			segment.up0.copy(subray.up0);
			segment.up1.copy(subray.up1);
			segment.radius0 = subray.radius0;
			segment.radius1 = subray.radius1;
			segment.fraction0 = 0;
			segment.fraction1 = 1;
			segment.positionVariationFactor = 1 - subray.straightness;

			this.subrayProbability = this.ramification * Math.pow(this.recursionProbability, subray.recursion) / (1 << subray.maxIterations);
			this.fractalRayRecursive(segment);
		}

		this.currentSegmentCallback = null;
		this.currentSubray = null;
	}

	fractalRayRecursive(segment) {
		// Leave recursion condition
		if (segment.iteration >= this.currentSubray.maxIterations) {
			this.currentSegmentCallback(segment);
			return;
		}

		// Interpolation
		this.forwards.subVectors(segment.pos1, segment.pos0);
		let lForwards = this.forwards.length();

		if (lForwards < 0.000001) {
			this.forwards.set(0, 0, 0.01);
			lForwards = this.forwards.length();
		}

		const middleRadius = (segment.radius0 + segment.radius1) * 0.5;
		const middleFraction = (segment.fraction0 + segment.fraction1) * 0.5;

		const timeDimension = this.time * this.currentSubray.timeScale * Math.pow(2, segment.iteration);

		this.middlePos.lerpVectors(segment.pos0, segment.pos1, 0.5);
		this.middleLinPos.lerpVectors(segment.linPos0, segment.linPos1, 0.5);
		const p = this.middleLinPos;

		// Noise
		this.newPos.set(
			this.simplexX.noise4d(p.x, p.y, p.z, timeDimension),
			this.simplexY.noise4d(p.x, p.y, p.z, timeDimension),
			this.simplexZ.noise4d(p.x, p.y, p.z, timeDimension)
		);

		this.newPos.multiplyScalar(segment.positionVariationFactor * lForwards);
		this.newPos.add(this.middlePos);

		// Recursion
		const newSegment1 = this.getNewSegment();
		newSegment1.pos0.copy(segment.pos0);
		newSegment1.pos1.copy(this.newPos);
		newSegment1.linPos0.copy(segment.linPos0);
		newSegment1.linPos1.copy(this.middleLinPos);
		newSegment1.up0.copy(segment.up0);
		newSegment1.up1.copy(segment.up1);
		newSegment1.radius0 = segment.radius0;
		newSegment1.radius1 = middleRadius;
		newSegment1.fraction0 = segment.fraction0;
		newSegment1.fraction1 = middleFraction;
		newSegment1.positionVariationFactor = segment.positionVariationFactor * this.currentSubray.roughness;
		newSegment1.iteration = segment.iteration + 1;

		const newSegment2 = this.getNewSegment();
		newSegment2.pos0.copy(this.newPos);
		newSegment2.pos1.copy(segment.pos1);
		newSegment2.linPos0.copy(this.middleLinPos);
		newSegment2.linPos1.copy(segment.linPos1);
		this.cross1.crossVectors(segment.up0, this.forwards.normalize());
		newSegment2.up0.crossVectors(this.forwards, this.cross1).normalize();
		newSegment2.up1.copy(segment.up1);
		newSegment2.radius0 = middleRadius;
		newSegment2.radius1 = segment.radius1;
		newSegment2.fraction0 = middleFraction;
		newSegment2.fraction1 = segment.fraction1;
		newSegment2.positionVariationFactor = segment.positionVariationFactor * this.currentSubray.roughness;
		newSegment2.iteration = segment.iteration + 1;

		this.fractalRayRecursive(newSegment1);
		this.fractalRayRecursive(newSegment2);
	}

	createPrism(segment) {
		// Creates one triangular prism and its vertices at the segment
		this.forwardsFill.subVectors(segment.pos1, segment.pos0).normalize();

		if (this.isInitialSegment) {
			this.currentCreateTriangleVertices(segment.pos0, segment.up0, this.forwardsFill, segment.radius0, 0);
			this.isInitialSegment = false;
		}

		this.currentCreateTriangleVertices(segment.pos1, segment.up0, this.forwardsFill, segment.radius1, segment.fraction1);
		this.createPrismFaces();
	}

	createTriangleVerticesWithoutUVs(pos, up, forwards, radius) {
		// Create an equilateral triangle (only vertices)
		this.side.crossVectors(up, forwards).multiplyScalar(radius * LightningStrike.COS30DEG);
		this.down.copy(up).multiplyScalar(-radius * LightningStrike.SIN30DEG);

		const p = this.vPos;
		const v = this.vertices;

		p.copy(pos).sub(this.side).add(this.down);
		v[this.currentCoordinate++] = p.x;
		v[this.currentCoordinate++] = p.y;
		v[this.currentCoordinate++] = p.z;

		p.copy(pos).add(this.side).add(this.down);
		v[this.currentCoordinate++] = p.x;
		v[this.currentCoordinate++] = p.y;
		v[this.currentCoordinate++] = p.z;

		p.copy(up).multiplyScalar(radius).add(pos);
		v[this.currentCoordinate++] = p.x;
		v[this.currentCoordinate++] = p.y;
		v[this.currentCoordinate++] = p.z;

		this.currentVertex += 3;
	}

	createPrismFaces() {
		const indices = this.indices;
		let vertex = this.currentVertex - 6;

		indices[this.currentIndex++] = vertex + 1;
		indices[this.currentIndex++] = vertex + 2;
		indices[this.currentIndex++] = vertex + 5;
		indices[this.currentIndex++] = vertex + 1;
		indices[this.currentIndex++] = vertex + 5;
		indices[this.currentIndex++] = vertex + 4;
		indices[this.currentIndex++] = vertex + 0;
		indices[this.currentIndex++] = vertex + 1;
		indices[this.currentIndex++] = vertex + 4;
		indices[this.currentIndex++] = vertex + 0;
		indices[this.currentIndex++] = vertex + 4;
		indices[this.currentIndex++] = vertex + 3;
		indices[this.currentIndex++] = vertex + 2;
		indices[this.currentIndex++] = vertex + 0;
		indices[this.currentIndex++] = vertex + 3;
		indices[this.currentIndex++] = vertex + 2;
		indices[this.currentIndex++] = vertex + 3;
		indices[this.currentIndex++] = vertex + 5;
	}

	createDefaultSubrayCreationCallbacks() {
		const random1 = this.randomGenerator.random;

		this.onDecideSubrayCreation = function (segment, lightningStrike) {
			// Decide subrays creation at parent (sub)ray segment
			const subray = lightningStrike.currentSubray;

			const period = lightningStrike.rayParameters.subrayPeriod;
			const dutyCycle = lightningStrike.rayParameters.subrayDutyCycle;

			const phase0 = (lightningStrike.rayParameters.isEternal && subray.recursion == 0) ?
				-random1() * period :
				MathUtils.lerp(subray.birthTime, subray.endPropagationTime, segment.fraction0) - random1() * period;

			const phase = lightningStrike.time - phase0;
			const currentCycle = Math.floor(phase / period);

			const childSubraySeed = random1() * (currentCycle + 1);

			const isActive = phase % period <= dutyCycle * period;

			let probability = 0;

			if (isActive) {
				probability = lightningStrike.subrayProbability;
			}

			if (subray.recursion < lightningStrike.maxSubrayRecursion &&
				lightningStrike.numSubrays < lightningStrike.maxSubrays &&
				random1() < probability) {

				const childSubray = lightningStrike.addNewSubray();

				const parentSeed = lightningStrike.randomGenerator.getSeed();
				childSubray.seed = childSubraySeed;
				lightningStrike.randomGenerator.setSeed(childSubraySeed);

				childSubray.recursion = subray.recursion + 1;
				childSubray.maxIterations = Math.max(1, subray.maxIterations - 1);

				childSubray.linPos0.set(random1(), random1(), random1()).multiplyScalar(1000);
				childSubray.linPos1.set(random1(), random1(), random1()).multiplyScalar(1000);
				childSubray.up0.copy(subray.up0);
				childSubray.up1.copy(subray.up1);
				childSubray.radius0 = segment.radius0 * lightningStrike.rayParameters.radius0Factor;
				childSubray.radius1 = Math.min(lightningStrike.rayParameters.minRadius, segment.radius1 * lightningStrike.rayParameters.radius1Factor);

				childSubray.birthTime = phase0 + (currentCycle) * period;
				childSubray.deathTime = childSubray.birthTime + period * dutyCycle;

				if (!lightningStrike.rayParameters.isEternal && subray.recursion == 0) {
					childSubray.birthTime = Math.max(childSubray.birthTime, subray.birthTime);
					childSubray.deathTime = Math.min(childSubray.deathTime, subray.deathTime);
				}

				childSubray.timeScale = subray.timeScale * 2;
				childSubray.roughness = subray.roughness;
				childSubray.straightness = subray.straightness;
				childSubray.propagationTimeFactor = subray.propagationTimeFactor;
				childSubray.vanishingTimeFactor = subray.vanishingTimeFactor;

				lightningStrike.onSubrayCreation(segment, subray, childSubray, lightningStrike);
				lightningStrike.randomGenerator.setSeed(parentSeed);
			}
		};

		this.onSubrayCreation = function (segment, parentSubray, childSubray, lightningStrike) {
			// Decide childSubray origin and destination positions (pos0 and pos1) and possibly other properties of childSubray
			// Just use the default cone position generator
			lightningStrike.subrayCylinderPosition(segment, parentSubray, childSubray, 0.5, 0.6, 0.2);
		};

		this.subrayCylinderPosition = function (segment, parentSubray, childSubray, heightFactor, sideWidthFactor, minSideWidthFactor) {
			// Sets childSubray pos0 and pos1 in a cylinder
			childSubray.pos0.copy(segment.pos0);

			// Define local vector variables to fix the bug
			const vec1Pos = new Vector3();
			const vec2Forward = new Vector3();
			const vec3Side = new Vector3();
			const vec4Up = new Vector3();

			vec1Pos.subVectors(parentSubray.pos1, parentSubray.pos0);
			vec2Forward.copy(vec1Pos).normalize();
			vec1Pos.multiplyScalar(segment.fraction0 + (1 - segment.fraction0) * ((2 * random1() - 1) * heightFactor));
			const length = vec1Pos.length();
			vec3Side.crossVectors(parentSubray.up0, vec2Forward);
			const angle = 2 * Math.PI * random1();
			vec3Side.multiplyScalar(Math.cos(angle));
			vec4Up.copy(parentSubray.up0).multiplyScalar(Math.sin(angle));

			childSubray.pos1.copy(vec3Side)
				.add(vec4Up)
				.multiplyScalar(length * sideWidthFactor * (minSideWidthFactor + random1() * (1 - minSideWidthFactor)))
				.add(vec1Pos)
				.add(parentSubray.pos0);
		};
	}

	createSubray() {
		return {
			seed: 0,
			maxIterations: 0,
			recursion: 0,
			pos0: new Vector3(),
			pos1: new Vector3(),
			linPos0: new Vector3(),
			linPos1: new Vector3(),
			up0: new Vector3(),
			up1: new Vector3(),
			radius0: 0,
			radius1: 0,
			birthTime: 0,
			deathTime: 0,
			timeScale: 0,
			roughness: 0,
			straightness: 0,
			propagationTimeFactor: 0,
			vanishingTimeFactor: 0,
			endPropagationTime: 0,
			beginVanishingTime: 0
		};
	}

	createSegment() {
		return {
			iteration: 0,
			pos0: new Vector3(),
			pos1: new Vector3(),
			linPos0: new Vector3(),
			linPos1: new Vector3(),
			up0: new Vector3(),
			up1: new Vector3(),
			radius0: 0,
			radius1: 0,
			fraction0: 0,
			fraction1: 0,
			positionVariationFactor: 0
		};
	}

	getNewSegment() {
		return this.raySegments[this.currentSegmentIndex++];
	}

}

// Ray states
LightningStrike.RAY_INITIALIZED = 0;
LightningStrike.RAY_UNBORN = 1;
LightningStrike.RAY_PROPAGATING = 2;
LightningStrike.RAY_STEADY = 3;
LightningStrike.RAY_VANISHING = 4;
LightningStrike.RAY_EXTINGUISHED = 5;

LightningStrike.COS30DEG = Math.cos(30 * Math.PI / 180);
LightningStrike.SIN30DEG = Math.sin(30 * Math.PI / 180);

/**
 * LightningSystem class to manage multiple lightning strikes
 */
export class LightningSystem {
	constructor(scene) {
		this.scene = scene;
		this.lightningStrikes = [];
		this.lightningMeshes = [];
		this.sourceMarkers = [];
		this.sourcePositions = [];
	}

	/**
	 * Set source positions for lightning strikes
	 * @param {Array<THREE.Vector3>} positions - Array of source positions
	 */
	setSourcePositions(positions) {
		this.sourcePositions = positions;
	}

	/**
	 * Create lightning strikes between source positions
	 * @param {Object} params - Lightning parameters
	 */
	createLightningStrikesBetweenSources(params) {
		// Remove existing lightning strikes if they exist
		this.lightningMeshes.forEach(mesh => {
			if (mesh) this.scene.remove(mesh);
		});

		this.lightningMeshes = [];
		this.lightningStrikes = [];

		// Create lightning strikes between sources
		const connections = [];
		for (let i = 0; i < this.sourcePositions.length - 1; i++) {
			connections.push({
				source: this.sourcePositions[i],
				target: this.sourcePositions[i+1],
				params: params
			});
		}

		if (connections.length === 0) {
			// No valid connections found
			return;
		}

		const strikes = createLightningStrikes(connections);
		this.lightningStrikes = strikes;

		// Create meshes with a more visible material
		strikes.forEach((strike, index) => {
			const material = new THREE.MeshBasicMaterial({ 
				color: 0x00ffff,
				transparent: true,
				opacity: 0.8
			});
			const mesh = new THREE.Mesh(strike, material);
			this.lightningMeshes.push(mesh);
			this.scene.add(mesh);
		});
	}

	/**
	 * Update lightning strikes
	 * @param {number} time - Current time for animation
	 */
	update(time) {
		// Prepare update data for valid strikes
		const validConnections = [];
		for (let i = 0; i < this.sourcePositions.length - 1; i++) {
			if (this.sourcePositions[i] && this.sourcePositions[i+1]) {
				validConnections.push({ 
					source: this.sourcePositions[i], 
					target: this.sourcePositions[i+1] 
				});
			}
		}

		// Update lightning strikes using utility function
		if (this.lightningStrikes.length > 0 && validConnections.length > 0) {
			updateLightningStrikes(this.lightningStrikes, validConnections, time);
		}
	}

	/**
	 * Create visual markers for source positions
	 */
	createSourceMarkers() {
		// Remove existing markers
		this.sourceMarkers.forEach(marker => {
			if (marker) this.scene.remove(marker);
		});
		this.sourceMarkers = [];

		// Create a small sphere at each source position
		this.sourcePositions.forEach((position, index) => {
			const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
			const markerMaterial = new THREE.MeshBasicMaterial({ 
				color: 0xff0000,
				transparent: true,
				opacity: 0.5
			});
			const marker = new THREE.Mesh(markerGeometry, markerMaterial);
			marker.position.copy(position);
			this.sourceMarkers.push(marker);
		});
	}

	/**
	 * Clean up lightning system
	 */
	destroy() {
		this.lightningMeshes.forEach(mesh => {
			if (mesh) this.scene.remove(mesh);
		});
		this.sourceMarkers.forEach(marker => {
			if (marker) this.scene.remove(marker);
		});
		this.lightningMeshes = [];
		this.lightningStrikes = [];
		this.sourceMarkers = [];
	}
}