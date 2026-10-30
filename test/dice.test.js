// 3D 骰子停下時，朝上的面要等於 engine 擲出的點數：node --test test/dice.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { BOARD_TOP_Y, DIE_HALF, dieRestY, orientationFor, topFaceValue } from "../src/board3d.js";

test("每個點數在各種偏航角度下都正面朝上，且點數正確", () => {
  const up = new THREE.Vector3(0, 1, 0);
  for (const value of [1, 2, 3]) {
    for (let i = 1; i <= 200; i++) {
      const q = orientationFor(value, i * 0.83 + (value % 2) * 0.45);
      assert.equal(topFaceValue(q), value);
      const normals = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((n) => new THREE.Vector3(...n).applyQuaternion(q));
      assert.ok(normals.some((n) => Math.abs(n.dot(up)) > 0.999), `點數 ${value} 第 ${i} 次停下時是歪的`);
    }
  }
});

test("骰子不論朝向，最低的角都剛好貼在桌板上（不懸空也不穿透）", () => {
  const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3(x, y, z).multiplyScalar(DIE_HALF))));
  const axis = new THREE.Vector3(1, 2, 3).normalize();
  for (let i = 0; i < 200; i++) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, i * 0.37);
    const lowest = Math.min(...corners.map((c) => c.clone().applyQuaternion(q).y));
    assert.ok(Math.abs(dieRestY(q) + lowest - BOARD_TOP_Y) < 1e-9, `第 ${i} 次`);
  }
});
