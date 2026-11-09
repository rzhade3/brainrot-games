import * as THREE from 'three';
import { bakeryDeck, fridgeDecks, parkingRows, parkingSpaces, produceBins, produceTiers, promoDeck, shelfDecks, storefront, type Grocery } from './supermarket';

type AddBox = (parent: THREE.Object3D, x: number, y: number, z: number,
  width: number, height: number, depth: number, color: number) => THREE.Mesh;

export function buildSupermarketFloor(floor: THREE.Group, box: AddBox) {
  box(floor, 0, -.62, 0, 212, 1, 212, 0x85917d);
  box(floor, 0, -.04, 0, 180, .08, 180, 0x555e60);
  for (let x = -84; x <= 84; x += 12) for (let z = -84; z < storefront; z += 12) {
    const alternate = (x + z) % 24 === 0;
    const tiles = z < -66 ? [0xb4c8c7, 0xc0d2cf] : x > 18 && z >= -12 ? [0xc8d3b3, 0xd3ddbe] : x > 18 ? [0xdcc2a4, 0xe6cdaf] : z > 34 ? [0xdfc1a5, 0xe7cbb1] : [0xe1d6bf, 0xe9dfcb];
    const depth = Math.min(12, storefront - z + 6);
    box(floor, x, 0, z + (depth - 12) / 2, 11.94, .12, depth - .06, tiles[Number(alternate)]);
  }
  for (const side of [-1, 1]) {
    box(floor, side * 90, 1.1, -17.5, 1.5, 2.2, 145, 0x806a56);
  }
  box(floor, 0, 1.75, -90, 181, 3.5, 1.5, 0x806a56);
  box(floor, 0, .07, storefront + 2, 180, .14, 4, 0xbcb4a2);
  for (const [x, width] of [[-75, 30], [-7, 62], [76, 28]]) {
    box(floor, x, .45, storefront, width, .9, 1.5, 0xa26047);
    box(floor, x, 2.32, storefront, width, 2.85, .7, 0x6a9a91);
    box(floor, x, 3.95, storefront, width, .65, 1.65, 0x395d51);
    for (let pane = x - width / 2 + 4; pane < x + width / 2; pane += 6) {
      box(floor, pane, 2.3, storefront + .39, .2, 2.85, .1, 0xd0c4a9);
    }
  }
  for (const x of [-56, -43, 29, 58]) box(floor, x, 1.8, storefront, .55, 3.6, .9, 0x395d51);
  for (let x = 29.5; x < 58; x += 1.7) {
    box(floor, x, 3.6, storefront + 1.2, 1.68, .32, 2.8, Math.round(x / 1.7) % 2 ? 0xdbba78 : 0x9d5442);
  }
  for (const x of [-79, -67, -55, -43, -31, -19, -7, 5]) box(floor, x, .066, 45, .2, .012, 19, 0xb08f64);

  for (const z of parkingRows) for (const x of parkingSpaces) {
    box(floor, x - 4.7, .009, z, .15, .016, 9.4, 0xe4dec5);
    box(floor, x, .009, z + (z === parkingRows[0] ? -4.8 : 4.8), 9.5, .016, .15, 0xe4dec5);
  }
  for (let z = 60; z <= 86; z += 2.4) box(floor, 48, .012, z, 6.4, .02, 1.1, 0xdcd6bd);
  for (const x of [-79, -27, 18, 70]) {
    box(floor, x, .12, 57.7, 4.6, .24, 2.5, 0xb9ad92);
    box(floor, x, .31, 57.7, 4.2, .24, 2.1, 0x6e7950);
    box(floor, x, 2.85, 57.7, .24, 5.4, .24, 0x454e50);
    box(floor, x + .4, 5.5, 57.7, 1.05, .17, .36, 0xd8cbaa);
  }
  box(floor, 86, .01, 68, .2, .018, 9, 0xe1c282);

  for (const [label, x, z, color, face] of [
    ['FRESH PRODUCE', 46, 50, '#4a7653', false], ['GROCERY', -32, -35, '#8a795a', false],
    ['BAKERY', 45, -41, '#9b5b41', false],
    ['DAIRY & CHILLED', 0, -73, '#416d75', false], ['CHECKOUT', -46, 54, '#995f48', false],
    ['HOLE FOODS', -5, storefront + .84, '#fff2cf', true],
  ] as const) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.font = 'bold 76px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = color; context.fillText(label, 256, 68, 490);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(face ? 15 : 24, face ? 2.8 : 6), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    if (!face) sign.rotation.x = -Math.PI / 2;
    sign.position.set(x, face ? 2.65 : .075, z);
    floor.add(sign);
  }
}

const fruitGeometry = new THREE.IcosahedronGeometry(.43, 1);
const canGeometry = new THREE.CylinderGeometry(.36, .36, .78, 12);
const produceColors = [0xe05738, 0xf29436, 0x94ad46];
const labelColors = [0xd9674f, 0x518b9a, 0xe2ac48, 0x738a54];
const trim = 0x315e56;
const metal = 0xb8c5be;

export function groceryVariant(kind: Grocery, index: number) {
  return index % (kind === 'fruit' || kind === 'produce-stand' ? produceColors.length : labelColors.length);
}

export function buildGrocery(group: THREE.Group, kind: Grocery, index: number, box: AddBox) {
  const block = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number) =>
    box(group, x, y, z, width, height, depth, color);
  const label = labelColors[index % labelColors.length];
  switch (kind) {
    case 'fruit':
      block(0, .37, 0, 1, index === 2 ? 1.13 : .88, 1, produceColors[index]).geometry = fruitGeometry;
      block(.08, index === 2 ? .85 : .74, 0, .12, .12, .24, 0x486b3e);
      break;
    case 'can': {
      block(0, .39, 0, 1, 1, 1, label).geometry = canGeometry;
      const lid = block(0, .8, 0, 1, .08, 1, metal);
      lid.geometry = canGeometry;
      break;
    }
    case 'milk': {
      block(0, .45, 0, .65, .9, .64, 0xede9d7);
      block(0, .36, .325, .62, .37, .03, label);
      block(0, .96, 0, .64, .18, .38, 0xe1e0d3);
      block(.12, 1.08, .05, .2, .08, .2, label);
      break;
    }
    case 'bread':
      block(0, .23, 0, .74, .42, .82, 0xb8783d);
      block(0, .42, 0, .91, .42, 1, 0xda9e53).geometry = fruitGeometry;
      for (const z of [-.17, .1]) block(0, .59, z, .27, .03, .065, 0xf4d593);
      break;
    case 'basket':
    case 'cart': {
      const cart = kind === 'cart';
      const width = cart ? 1.95 : 1.8, depth = cart ? 2.85 : 2.3;
      const bottom = cart ? .9 : .18, rim = bottom + .8, color = cart ? metal : label;
      const handleZ = cart ? depth / 2 : 0;
      block(0, bottom, 0, width, .3, depth, color);
      for (const side of [-1, 1]) {
        block(side * width / 2, rim, 0, .14, .16, depth, color);
        block(0, rim, side * depth / 2, width, .16, .14, color);
        for (const z of [-depth / 3, 0, depth / 3]) block(side * width / 2, bottom + .45, z, .12, .8, .12, color);
        block(side * width / 2, rim + .2, handleZ, .14, .5, .18, color);
        if (cart) for (const z of [-depth * .35, depth * .35]) block(side * (width / 2 - .2), .41, z, .28, .82, .55, trim);
      }
      block(0, rim + .45, handleZ, width, .19, .24, cart ? label : trim);
      break;
    }
    case 'shopper': {
      const shirt = [0xaa6551, 0x776293, 0x607a51, 0xc59752][index];
      const skin = [0xd6a17e, 0xb97d5e, 0x9c614c, 0xedbb93][index];
      const face = [0xe0af8e, 0xc38d70, 0xa9715a, 0xf2c6a0][index];
      const hair = [0x49342b, 0x382d32, 0x352d29, 0x936346][index];
      const pants = [0x394d60, 0x4e5052, 0x696153, 0x4b5a62][index];
      block(0, 1.57, .02, .81, .34, .51, pants);
      block(0, 2.23, .02, .92, 1.12, .55, shirt).rotation.x = .12;
      block(0, 2.85, .1, .28, .25, .28, skin);
      block(0, 3.21, .11, .77, .94, .75, face).geometry = fruitGeometry;
      block(0, 3.53, .04, .57, .24, .56, hair);
      block(0, 3.28, -.19, .53, .47, .13, hair);
      for (const side of [-1, 1]) {
        block(side * .115, 3.26, .41, .052, .06, .04, 0x342923);
        const sleeve = block(side * .48, 2.44, .2, .23, .64, .26, shirt);
        const forearm = block(side * .46, 2.18, .49, .19, .2, .44, skin);
        const hand = block(side * .45, 2.13, .7, .19, .21, .23, skin);
        sleeve.rotation.x = -.46;
        forearm.rotation.x = .18;
        for (const arm of [sleeve, forearm, hand]) arm.userData.limb = side * 2;
        block(side * .215, .86, 0, .31, 1.38, .36, pants).userData.limb = side;
        block(side * .215, .16, .1, .34, .24, .56, 0x35383b).userData.limb = side;
        block(side * .215, .065, .1, .35, .08, .58, 0xd3c9b5).userData.limb = side;
      }
      break;
    }
    case 'promo-bin':
      block(0, .32, 0, 2.65, .64, 2.9, 0x9a7450);
      block(0, promoDeck - .13, 0, 2.85, .26, 3, 0xbb925c);
      block(0, .75, 1.51, 1.25, .33, .05, 0xc66742);
      break;
    case 'bakery-case':
      block(0, .53, 0, 6.7, 1.06, 3.7, 0xa46a44);
      block(0, bakeryDeck - .1, 0, 6.8, .2, 3.8, 0xd4a572);
      block(0, 1.61, -1.72, 6.65, .76, .2, 0x916240);
      for (const side of [-1, 1]) block(side * 3.28, 1.43, 0, .17, .37, 3.62, 0xc5905e);
      for (const x of [-2.3, 0, 2.3]) block(x, 1.22, 1.93, .77, .28, .055, 0xf3dfb7);
      break;
    case 'checkout':
      block(0, .9, 0, 2.7, 1.8, 6.4, 0xa8b9ad);
      block(0, 1.85, -.55, 2.4, .18, 4.7, 0x374746);
      for (const side of [-1, 1]) block(side * 1.25, 1.98, -.55, .2, .22, 4.9, metal);
      block(0, 1.87, 2.5, 2.7, .22, 1.4, label);
      block(.65, 2.35, 2.4, 1.05, .85, .6, trim);
      block(.65, 2.47, 2.08, .82, .39, .1, 0xc1ddc4);
      break;
    case 'produce-stand':
      for (const { x, height } of produceTiers) {
        block(x, (height - .16) / 2, 0, 2.2, height - .16, 6.6, 0xb18753);
        for (const z of produceBins) {
          block(x, height - .08, z, 2.2, .16, 3.25, 0x537a59);
          for (const side of [-1, 1]) {
            block(x + side * 1.05, height + .12, z, .12, .32, 3.25, trim);
            block(x, height + .12, z + side * 1.57, 2.2, .32, .12, trim);
          }
          block(x + 1.12, height + .14, z, .05, .17, .68, 0xffeac4);
        }
      }
      break;
    case 'shelf':
      block(0, 1.58, 0, .26, 3.16, 14, trim);
      block(0, .21, 0, 4.5, .42, 13.8, 0x82938a);
      for (const height of shelfDecks) {
        block(0, height - .1, 0, 4.8, .2, 14, metal);
        for (const side of [-1, 1]) block(side * 2.42, height - .06, 0, .12, .21, 14, label);
      }
      for (const z of [-6.8, 6.8]) block(0, 1.56, z, .38, 3.12, .32, trim);
      break;
    case 'fridge':
      block(0, 2.45, -1.9, 7.3, 4.9, .38, 0x62848a);
      block(0, .39, 0, 7.3, .78, 4.4, 0x485f65);
      block(0, 4.95, 0, 7.3, .52, 4.4, 0x729397);
      block(0, 4.95, 2.22, 6.8, .2, .07, 0x4e7f83);
      block(-2.55, 4.95, 2.27, 1.25, .16, .035, 0xe7e0bb);
      for (const side of [-1, 1]) block(side * 3.52, 2.7, 0, .28, 4.9, 4.4, 0x899e9b);
      for (const height of fridgeDecks) {
        block(0, height - .09, 0, 7, .18, 4.1, 0xc2d4d1);
        block(0, height - .08, 2.06, 6.8, .1, .07, 0x83b4b0);
        for (const x of [-2, 0, 2]) block(x, height - .08, 2.11, .43, .085, .025, 0xe4cea0);
      }
      for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) block(x, .38, 2.21, .95, .21, .05, 0x33484d);
      break;
    case 'parked-car':
    case 'delivery-van': {
      const van = kind === 'delivery-van';
      const length = van ? 8.6 : 6.2, width = van ? 3.8 : 3.25;
      block(0, .95, 0, width, 1.1, length, van ? 0xe3dfc7 : label);
      block(0, 1.67, -length * .12, width * .84, .72, length * .42, 0x577981);
      block(0, 2.08, -length * .13, width * .83, .24, length * .34, van ? 0xeee8d5 : label);
      if (van) {
        block(0, 2.2, -length * .2, width, 2.9, length * .57, 0xeee8d5);
        for (const side of [-1, 1]) block(side * (width / 2 + .012), 2.1, -length * .22, .04, .75, length * .53, label);
      }
      for (const side of [-1, 1]) {
        for (const z of [-length * .31, length * .31]) {
          block(side * width * .46, .49, z, .48, .85, 1.08, 0x303c3d);
          block(side * width * .53, .49, z, .06, .45, .52, 0x9ca8a0);
        }
        block(side * width * .35, 1.1, length / 2 + .025, .62, .28, .07, 0xf7e8b2);
        block(side * width * .35, 1.03, -length / 2 - .025, .54, .26, .07, 0xa4423a);
      }
      break;
    }
  }
}
