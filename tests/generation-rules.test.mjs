import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
const elements = new Map();

function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      addEventListener() {},
      className: "",
      complete: false,
      hidden: false,
      naturalWidth: 0,
      replaceChildren() {},
      textContent: "",
      value: id === "seed" ? "TEST" : "0",
    });
  }
  return elements.get(id);
}

const context = vm.createContext({
  Blob,
  DataView,
  Math,
  Object,
  Set,
  String,
  TextEncoder,
  Uint8Array,
  Uint32Array,
  URL,
  btoa,
  document: {
    getElementById: element,
    querySelectorAll() { return []; },
    querySelector() { return { value: "easy" }; },
  },
  setTimeout() {},
});

vm.runInContext(source, context, { filename: "script.js" });

function evaluate(expression) {
  return vm.runInContext(`JSON.parse(JSON.stringify(${expression}))`, context);
}

test("tous les signaux commencent au niveau moyen sur la première ligne de grille", () => {
  for (const level of ["easy", "medium", "hard"]) {
    const phases = evaluate(`rules(${JSON.stringify(level)}).ph`);
    assert.equal(phases.length, 1, `${level} autorise plusieurs phases`);
    assert.equal(phases[0], 0, `${level} autorise encore un décalage de phase`);
  }
});

test("la largeur affiche entre une et deux périodes", () => {
  for (const level of ["easy", "medium", "hard"]) {
    const periodsInDivisions = evaluate(`rules(${JSON.stringify(level)}).p`);
    for (const divisions of periodsInDivisions) {
      const visiblePeriods = 10 / divisions;
      assert.ok(
        visiblePeriods >= 1 && visiblePeriods <= 2,
        `${level}: ${visiblePeriods} périodes visibles pour ${divisions} divisions`,
      );
    }
  }
});

test("la zone de tracé coïncide avec les lignes extrêmes du quadrillage", () => {
  const screen = evaluate("SCREEN");
  const imageWidth = 1302;
  const imageHeight = 896;

  assert.ok(Math.abs(screen.left * imageWidth / 100 - 156) <= 0.5, "origine horizontale hors de la première ligne");
  assert.ok(Math.abs((screen.left + screen.width) * imageWidth / 100 - 850.5) <= 0.5, "fin horizontale hors de la dernière ligne");
  assert.ok(Math.abs(screen.top * imageHeight / 100 - 159) <= 0.5, "origine verticale hors de la première ligne");
  assert.ok(Math.abs((screen.top + screen.height) * imageHeight / 100 - 738.5) <= 0.5, "fin verticale hors de la dernière ligne");
});

test("les invariants restent vrais sur plusieurs banques générées", () => {
  const generated = evaluate(`(() => {
    const rows = [];
    for (const level of ["easy", "medium", "hard"]) {
      for (let bank = 0; bank < 20; bank++) {
        const used = new Set();
        for (let index = 1; index <= 50; index++) {
          const item = exercise(level, "BANQUE-" + bank, index, used);
          rows.push({ level, pd: item.pd, ph: item.ph });
        }
      }
    }
    return rows;
  })()`);

  assert.equal(generated.length, 3000);
  for (const item of generated) {
    assert.equal(item.ph, 0, `${item.level}: phase non alignée`);
    assert.ok(item.pd >= 5 && item.pd <= 10, `${item.level}: période de ${item.pd} divisions`);
  }
});

test("chaque niveau conserve une capacité de 500 exercices uniques", () => {
  const counts = evaluate(`(() => {
    const result = {};
    for (const level of ["easy", "medium", "hard"]) {
      const used = new Set();
      for (let index = 1; index <= 500; index++) exercise(level, "CAPACITE", index, used);
      result[level] = used.size;
    }
    return result;
  })()`);

  assert.equal(counts.easy, 500);
  assert.equal(counts.medium, 500);
  assert.equal(counts.hard, 500);
});

test("triangles et carrés gardent leurs contraintes dans les trois niveaux", () => {
  const generated = evaluate(`(() => {
    const rows = [];
    for (const wave of ["triangle", "carre"]) for (const level of ["easy", "medium", "hard"]) {
      const used = new Set();
      for (let index = 1; index <= 500; index++) {
        const item = exercise(level, "FORMES", index, used, wave);
        validateExercise(item);
        rows.push(item);
      }
    }
    return rows;
  })()`);
  assert.equal(generated.length, 3000);
  for (const item of generated) {
    assert.ok(item.pd >= 5 && item.pd <= 10);
    const step = item.level === "easy" ? 1 : item.level === "medium" ? 0.5 : 0.2;
    const onGrid = value => Math.abs(value / step - Math.round(value / step)) < 1e-9;
    assert.ok(onGrid(item.pd), `${item.wave} ${item.level}: période hors graduations`);
    assert.ok(onGrid(item.ad), `${item.wave} ${item.level}: amplitude hors graduations`);
    if(item.wave === "carre"){
      assert.equal(item.lowDiv, -item.highDiv);
      assert.ok(!Object.hasOwn(item, "umoy"));
      assert.ok(Math.abs(item.D - 100 * item.hd / item.pd) < 1e-9);
      assert.ok(onGrid(item.hd), `${item.level}: durée haute hors graduations`);
      assert.ok(item.ad <= 3.5, "le carré touche une ligne horizontale extrême");
      assert.ok(1 + item.pd <= 9, "la première période entre dans la dernière division");
    }else{
      assert.equal(item.ph, 0);
      assert.ok(Math.abs(item.od) + item.ad <= 4);
      assert.ok(Math.abs(item.umoy - item.od * item.vd) < 1e-9);
      assert.ok(onGrid(item.od), `${item.level}: moyenne hors graduations`);
    }
  }
  assert.ok(generated.some(item => item.level === "hard" && Math.abs(item.ad * 2 - Math.round(item.ad * 2)) > 1e-9), "Hard n’utilise jamais les cinquièmes non entiers ou demi-entiers");
});

test("la banque 200TRI produit 250 triangles avec un Umax positif", () => {
  const generated = evaluate(`(() => {
    const rows = [];
    for (const [level, count] of [["easy", 100], ["medium", 100], ["hard", 50]]) {
      const used = new Set();
      for (let index = 1; index <= count; index++) {
        const item = exercise(level, "200TRI", index, used, "triangle");
        validateExercise(item);
        rows.push(item);
      }
    }
    return rows;
  })()`);

  assert.equal(generated.length, 250);
  for (const item of generated) assert.ok(item.umax > 0, `${item.seed}: Umax non positif`);
  assert.notEqual(generated.filter(item => item.level === "hard")[36].seed, "200TRI|triangle|hard|37|0");
});

test("un signal de 3 V centré sur -1 V passe de 2 à 1 V/div", () => {
  const scaled = evaluate('maximizeVertical("hard", 1, 1.5, -0.5)');
  assert.equal(scaled.vd, 1);
  assert.equal(scaled.ad, 3);
  assert.equal(scaled.od, -1);
  assert.equal(scaled.um, 3);
  assert.equal(scaled.umoy, -1);
});

test("le calibre vertical est optimal sans rogner le signal ni changer sa valeur", () => {
  const generated = evaluate(`(() => {
    const rows = [];
    for (const wave of ["sinus", "triangle"]) for (const level of ["easy", "medium", "hard"]) {
      for (let bank = 0; bank < 20; bank++) {
        const used = new Set();
        for (let index = 1; index <= 50; index++) {
          const item = exercise(level, "VERTICAL-" + bank, index, used, wave);
          rows.push({ level, vi: item.vi, vd: item.vd, ad: item.ad, od: item.od, um: item.um, umoy: item.umoy, umax: item.umax });
        }
      }
    }
    return { rows, calibres: VDIV };
  })()`);

  for (const item of generated.rows) {
    const step = item.level === "easy" ? 1 : item.level === "medium" ? 0.5 : 0.2;
    assert.ok(item.umax > 0, `${item.level}: maximum non positif`);
    assert.ok(Math.abs(item.od) + item.ad <= 4 + 1e-9, `${item.level}: courbe rognée`);
    assert.ok(Math.abs(item.ad * item.vd - item.um) < 1e-9, "amplitude modifiée");
    assert.ok(Math.abs(item.od * item.vd - item.umoy) < 1e-9, "valeur moyenne modifiée");
    assert.ok(Math.abs(item.umax - (item.ad + item.od) * item.vd) < 1e-9, "maximum physique erroné");
    assert.ok(Math.abs(item.ad / step - Math.round(item.ad / step)) < 1e-9, "amplitude illisible");
    assert.ok(Math.abs(item.od / step - Math.round(item.od / step)) < 1e-9, "moyenne illisible");

    for (const finer of generated.calibres.slice(item.vi + 1)) {
      const amplitude = item.um / finer;
      const offset = item.umoy / finer;
      const fits = Math.abs(offset) + amplitude <= 4 + 1e-9;
      const readable = [amplitude, offset].every(divisions =>
        Math.abs(divisions / step - Math.round(divisions / step)) < 1e-9,
      );
      assert.ok(!fits || !readable, `${item.level}: un calibre plus fin (${finer} V/div) convenait`);
    }
  }
});

test("la banque Moodle utilise le sommet réel pour Umax", async () => {
  context.sampleRows = [{
    id: "OSC-H-001", level: "hard", webp: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
    vd: 1, um: 3, umoy: -1, umax: 2, T: 0.01, f: 100,
  }];
  const xml = await vm.runInContext('moodleXml(sampleRows, "hard")', context);
  assert.match(xml, /Umax \(V\)<\/td><td>\{1:NUMERICAL:=2:0\.1\}/);
  assert.match(xml, /Umax = 2 V ; Umoy = -1 V/);
  assert.match(xml, /OSC-H-001\.webp/);
  assert.doesNotMatch(xml, /OSC-H-001\.png/);
});

test("corrigé, inventaire et XML Moodle donnent les quatre mêmes réponses", async () => {
  const rows = evaluate(`(() => {
    const result = [];
    for (const [wave, prefix] of [["sinus", "OSC"], ["triangle", "TRI"], ["carre", "CAR"]]) {
      for (const [level, code, count] of [["easy", "E", 50], ["medium", "M", 100], ["hard", "H", 50]]) {
        const used = new Set();
        for (let index = 1; index <= count; index++) {
          const item = exercise(level, "BANQUE-CORRIGE", index, used, wave);
          result.push({ ...item, id: prefix + "-" + code + "-" + String(index).padStart(3, "0"), file: wave + "/" + level + "/" + index + ".webp" });
        }
      }
    }
    return result;
  })()`);
  context.exportRows = rows.map(row => ({ ...row, webp: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }) }));
  const inventory = vm.runInContext("csv(exportRows)", context).replace(/^\uFEFF/, "").split("\r\n");
  const answerKey = vm.runInContext("answerKey(exportRows)", context).replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(inventory.length, 601);
  assert.equal(answerKey.length, 601);
  assert.equal(answerKey[0], "id;signal;Umoy_V;Umax_V;f_Hz;T_s;D_pct");
  const headers = inventory[0].split(";");
  const close = (actual, expected) => Math.abs(actual - expected) <= 2e-14 * Math.max(1e-12, Math.abs(expected));

  for (let index = 0; index < rows.length; index++) {
    const source = rows[index];
    const inventoryRow = Object.fromEntries(headers.map((header, position) => [header, inventory[index + 1].split(";")[position]]));
    const [id, wave, umoy, umax, frequency, period, duty] = answerKey[index + 1].split(";");
    const expected = {
      umoy: source.wave === "carre" ? null : source.od * source.vd,
      umax: source.wave === "carre" ? source.highDiv * source.vd : (source.od + source.ad) * source.vd,
      period: source.pd * source.td,
      frequency: 1 / (source.pd * source.td),
      duty: source.wave === "carre" ? source.hd / source.pd * 100 : null,
    };
    assert.equal(id, source.id);
    assert.equal(wave, source.wave);
    for (const [column, value] of [["Umax_V", expected.umax], ["f_Hz", expected.frequency], ["T_s", expected.period]]) {
      assert.ok(close(Number(inventoryRow[column]), value), `${id}: inventaire ${column}`);
    }
    if(source.wave === "carre"){
      assert.equal(umoy, "");
      assert.equal(inventoryRow.Umoy_V, "");
      assert.ok(close(Number(duty), expected.duty), `${id}: corrigé D`);
      assert.ok(close(Number(inventoryRow.D_pct), expected.duty), `${id}: inventaire D`);
    }else{
      assert.equal(duty, "");
      assert.ok(close(Number(umoy), expected.umoy), `${id}: corrigé Umoy`);
      assert.ok(close(Number(inventoryRow.Umoy_V), expected.umoy), `${id}: inventaire Umoy`);
    }
    for (const [value, expectedValue, label] of [[umax, expected.umax, "Umax"], [frequency, expected.frequency, "f"], [period, expected.period, "T"]]) {
      assert.ok(close(Number(value), expectedValue), `${id}: corrigé ${label}`);
    }
  }

  for (const wave of ["sinus", "triangle", "carre"]) for (const level of ["easy", "medium", "hard"]) {
    const xml = await vm.runInContext(`moodleXml(exportRows.filter(row => row.wave === "${wave}" && row.level === "${level}"), "${level}", "${wave}")`, context);
    const questions = xml.split('<question type="cloze">').slice(1);
    assert.equal(questions.length, rows.filter(row => row.wave === wave && row.level === level).length);
    for (const question of questions) {
      const id = question.match(/<name><text>([^<]+)<\/text><\/name>/)?.[1];
      const source = rows.find(row => row.id === id);
      assert.ok(source, `question XML inconnue : ${id}`);
      assert.match(question, new RegExp(`${id}\\.webp`));
      assert.doesNotMatch(question, new RegExp(`${id}\\.png`));
      const values = [...question.matchAll(/\{1:NUMERICAL:=([^:}]+):[^}]+\}/g)].map(match => Number(match[1]));
      assert.equal(values.length, 4, `${id}: nombre de réponses Moodle`);
      if(wave === "carre")assert.ok(!question.includes("Umoy (V)"), `${id}: Umoy demandée pour un carré`);
      const expectedValues=wave === "carre"?
        [source.highDiv * source.vd, source.pd * source.td, 1 / (source.pd * source.td), source.hd / source.pd * 100]:
        [(source.od + source.ad) * source.vd, source.od * source.vd, source.pd * source.td, 1 / (source.pd * source.td)];
      for (const [position, expected] of expectedValues.entries()) {
        assert.ok(close(values[position], expected), `${id}: réponse Moodle ${position + 1}`);
      }
    }
  }
});

test("une incohérence sur une réponse empêche l’export", () => {
  const source = evaluate('exercise("medium", "CONTROLE", 1, new Set())');
  context.invalidRow = { ...source, f: source.f * 1.1 };
  assert.throws(() => vm.runInContext("validateExercise(invalidRow)", context), /Valeurs incohérentes/);
  context.invalidRow = { ...source, umax: source.umax + source.vd };
  assert.throws(() => vm.runInContext("validateExercise(invalidRow)", context), /Valeurs incohérentes/);
  context.invalidRow = { ...source, umax: 0 };
  assert.throws(() => vm.runInContext("validateExercise(invalidRow)", context), /Valeurs incohérentes/);
});

test("la ligne moyenne rouge suit Umoy et disparaît quand Umoy vaut zéro", () => {
  const image = element("oscilloscopeImage");
  image.naturalWidth = 1302;
  image.naturalHeight = 896;

  function strokesFor(offset) {
    const strokes = [];
    let path = [];
    const drawing = {
      drawImage() {}, save() {}, restore() {}, beginPath() { path = []; },
      rect() {}, clip() {}, arc() {}, fill() {},
      moveTo(x, y) { path.push(["moveTo", x, y]); },
      lineTo(x, y) { path.push(["lineTo", x, y]); },
      stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth, path: [...path] }); },
    };
    context.testCanvas = { getContext() { return drawing; } };
    vm.runInContext(`render({ od: ${offset}, ad: 2, pd: 5, ph: 0, vi: 2, ti: 5 }, testCanvas)`, context);
    return strokes;
  }

  const red = strokesFor(1.5).filter(stroke => stroke.color === "#d62828");
  assert.equal(red.length, 1);
  assert.equal(red[0].path.length, 2);
  const [start, end] = red[0].path;
  assert.ok(Math.abs(start[1] - 156) < 0.01);
  assert.ok(Math.abs(end[1] - 850.5) < 0.01);
  assert.ok(Math.abs(start[2] - (448.75 - 1.5 * 579.5 / 8)) < 0.01);
  assert.equal(start[2], end[2]);
  assert.equal(strokesFor(0).filter(stroke => stroke.color === "#d62828").length, 0);
});

test("le triangle part de Umoy et le carré périodique se prolonge des deux côtés", () => {
  const image = element("oscilloscopeImage");
  image.naturalWidth = 1302;
  image.naturalHeight = 896;
  const sx = 156, cy = (159 + 738.5) / 2, px = (850.5 - sx) / 10, py = (738.5 - 159) / 8;

  function strokesFor(expression) {
    const strokes = [];
    let path = [];
    const drawing = {
      drawImage() {}, save() {}, restore() {}, beginPath() { path = []; },
      rect() {}, clip() {}, arc() {}, fill() {},
      moveTo(x, y) { path.push(["moveTo", x, y]); },
      lineTo(x, y) { path.push(["lineTo", x, y]); },
      stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth, path: [...path] }); },
    };
    context.testCanvas = { getContext() { return drawing; } };
    vm.runInContext(`render(${expression}, testCanvas)`, context);
    return strokes;
  }

  const triangle = strokesFor('{ wave:"triangle", od:1, ad:2, pd:8, vi:2, ti:5 }');
  const triangleTrace = triangle.find(stroke => stroke.color === "#08742a").path;
  assert.deepEqual(triangleTrace.slice(0, 4).map(point => point[0]), ["moveTo", "lineTo", "lineTo", "lineTo"]);
  assert.ok(Math.abs(triangleTrace[0][1] - sx) < 1e-9);
  assert.ok(Math.abs(triangleTrace[0][2] - (cy - py)) < 1e-9);
  assert.ok(Math.abs(triangleTrace[1][1] - (sx + 2 * px)) < 1e-9);
  assert.ok(Math.abs(triangleTrace[1][2] - (cy - 3 * py)) < 1e-9);
  assert.ok(Math.abs(triangleTrace[2][1] - (sx + 6 * px)) < 1e-9);
  assert.ok(Math.abs(triangleTrace[2][2] - (cy + py)) < 1e-9);
  assert.equal(triangle.filter(stroke => stroke.color === "#d62828").length, 1);

  const square = strokesFor('{ wave:"carre", highDiv:2, lowDiv:-2, pd:8, hd:2, vi:2, ti:5 }');
  const squareTrace = square.find(stroke => stroke.color === "#08742a").path;
  assert.deepEqual(squareTrace.slice(0, 5).map(point => point[0]), ["moveTo", "lineTo", "lineTo", "lineTo", "lineTo"]);
  assert.ok(Math.abs(squareTrace[0][1] - sx) < 1e-9);
  assert.ok(Math.abs(squareTrace[0][2] - (cy + 2 * py)) < 1e-9);
  assert.ok(Math.abs(squareTrace[1][1] - (sx + px)) < 1e-9);
  assert.ok(Math.abs(squareTrace[1][2] - (cy + 2 * py)) < 1e-9);
  assert.ok(Math.abs(squareTrace[2][1] - (sx + px)) < 1e-9);
  assert.ok(Math.abs(squareTrace[2][2] - (cy - 2 * py)) < 1e-9);
  assert.ok(Math.abs(squareTrace[3][1] - (sx + 3 * px)) < 1e-9);
  assert.ok(Math.abs(squareTrace[4][1] - (sx + 3 * px)) < 1e-9);
  assert.ok(Math.abs(squareTrace[5][1] - (sx + 9 * px)) < 1e-9);
  assert.ok(Math.abs(squareTrace[6][1] - (sx + 9 * px)) < 1e-9);
  assert.ok(Math.abs(squareTrace.at(-1)[1] - (sx + 10 * px)) < 1e-9);
  assert.ok(squareTrace.every(point => point[1] >= sx - 1e-9 && point[1] <= sx + 10 * px + 1e-9));

  const secondSquare = strokesFor('{ wave:"carre", highDiv:2, lowDiv:-2, pd:5, hd:1, vi:2, ti:5 }');
  const secondTrace = secondSquare.find(stroke => stroke.color === "#08742a").path;
  assert.ok(secondTrace.some(point => Math.abs(point[1] - (sx + 6 * px)) < 1e-9 && Math.abs(point[2] - (cy - 2 * py)) < 1e-9), "le second front montant manque");
  assert.ok(Math.abs(secondTrace.at(-1)[1] - (sx + 10 * px)) < 1e-9);
  assert.ok(Math.abs(secondTrace.at(-1)[2] - (cy + 2 * py)) < 1e-9);
  assert.ok(square.find(stroke => stroke.color === "#08742a").width > triangle.find(stroke => stroke.color === "#08742a").width);
  assert.equal(square.filter(stroke => stroke.color === "#d62828").length, 0);
});

test("l’archive contient des WebP pour Moodle et des PNG seulement sur demande", async () => {
  element("easyCount").value = "1";
  element("includePng").checked = false;
  const canvases = [];
  context.document.createElement = () => {
    const canvas = {
      width: 1302, height: 896,
      getContext() { return { drawImage() {} }; },
      toBlob(callback, type = "image/png") { callback(new Blob([new Uint8Array([1, 2, 3])], { type })); },
    };
    canvases.push(canvas);
    return canvas;
  };
  context.archiveEntries = [];
  context.archiveName = "";
  vm.runInContext(`
    render = () => {};
    zip = async entries => { archiveEntries = entries; return new Blob([]); };
    download = (_, name) => { archiveName = name; };
  `, context);

  await vm.runInContext("generate()", context);
  assert.equal(canvases[1].width, 900);
  assert.equal(canvases[1].height, 619);
  let names = context.archiveEntries.map(entry => entry.name);
  assert.ok(names.includes("easy/OSC-E-001.webp"));
  assert.ok(names.includes("moodle/oscillo-easy.xml"));
  assert.ok(names.includes("inventaire.csv"));
  assert.ok(names.includes("corrige.csv"));
  assert.ok(!names.some(name => name.endsWith(".png")));
  assert.match(context.archiveName, /-webp\.zip$/);
  const moodle = new TextDecoder().decode(context.archiveEntries.find(entry => entry.name === "moodle/oscillo-easy.xml").data);
  assert.match(moodle, /OSC-E-001\.webp/);
  assert.doesNotMatch(moodle, /OSC-E-001\.png/);

  element("includePng").checked = true;
  await vm.runInContext("generate()", context);
  names = context.archiveEntries.map(entry => entry.name);
  assert.ok(names.includes("easy/OSC-E-001.webp"));
  assert.ok(names.includes("easy/OSC-E-001.png"));
  assert.match(context.archiveName, /-webp-png\.zip$/);
  const moodleWithPng = new TextDecoder().decode(context.archiveEntries.find(entry => entry.name === "moodle/oscillo-easy.xml").data);
  assert.match(moodleWithPng, /OSC-E-001\.webp/);
  assert.doesNotMatch(moodleWithPng, /OSC-E-001\.png/);
});
