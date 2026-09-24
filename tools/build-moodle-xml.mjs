import fs from "node:fs";
import path from "node:path";

const bankRoot = path.resolve(process.argv[2] || "oscillo-banque-200-OSCILLO-2026");
const chunkSize = Number(process.argv[3] || 0);
const imageRoot = process.argv[4] ? path.resolve(process.argv[4]) : bankRoot;
const skipCount = Number(process.argv[5] || 0);
const csvPath = path.join(bankRoot, "inventaire.csv");
const outputDir = path.join(bankRoot, skipCount > 0 ? `moodle-a-partir-${skipCount + 1}` : chunkSize > 0 ? `moodle-lots-${chunkSize}` : "moodle");

function parseCsvLine(line) {
    const fields = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') { value += '"'; i++; }
            else quoted = !quoted;
        } else if (char === ";" && !quoted) {
            fields.push(value); value = "";
        } else value += char;
    }
    fields.push(value);
    return fields;
}

function readInventory() {
    const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "").trim();
    const lines = text.split(/\r?\n/);
    const headers = parseCsvLine(lines.shift());
    return lines.filter(Boolean).map(line => {
        const values = parseCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    });
}

function xmlEscape(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function cdata(value) {
    return String(value).replaceAll("]]>", "]]]]><![CDATA[>");
}

function number(value) {
    return Number(Number(value).toPrecision(15)).toString();
}

function numericalAnswer(value, tolerance) {
    return `{1:NUMERICAL:=${number(value)}:${number(tolerance)}}`;
}

function questionXml(row) {
    const relativeImagePath = row.fichier.replace(/\.png$/i, imageRoot === bankRoot ? ".png" : ".webp");
    const imagePath = path.join(imageRoot, relativeImagePath.replaceAll("/", path.sep));
    if (!fs.existsSync(imagePath)) throw new Error(`Image absente : ${imagePath}`);

    const imageName = path.basename(imagePath);
    const imageBase64 = fs.readFileSync(imagePath).toString("base64");
    const umax = row.Umax_V === undefined ? Number(row.Um_V) + Number(row.Umoy_V) : Number(row.Umax_V);
    const umoy = Number(row.Umoy_V);
    const period = Number(row.T_s);
    const frequency = Number(row.f_Hz);
    const vDiv = Number(row.V_div_V);
    const wave = row.signal || "sinus";
    const duty = Number(row.D_pct);

    const tolerances = {
        umax: umax === 0 ? vDiv * 0.1 : Math.abs(umax) * 0.05,
        umoy: umoy === 0 ? vDiv * 0.1 : Math.abs(umoy) * 0.05,
        period: Math.abs(period) * 0.05,
        frequency: Math.abs(frequency) * 0.05,
    };

    const values = wave === "carre" ? [
        ["Umax (V)", umax, tolerances.umax],
        ["T (s)", period, tolerances.period],
        ["f (Hz)", frequency, tolerances.frequency],
        ["D (%)", duty, Math.abs(duty) * 0.05],
    ] : [
        ["Umax (V)", umax, tolerances.umax],
        ["Umoy (V)", umoy, tolerances.umoy],
        ["T (s)", period, tolerances.period],
        ["f (Hz)", frequency, tolerances.frequency],
    ];
    const body = `<p><strong>Relevez les quatre caractéristiques du signal.</strong></p>
<p>Saisissez uniquement les valeurs numériques. Le point et la virgule sont acceptés comme séparateurs décimaux. N’ajoutez aucune unité.</p>
<p><img src="@@PLUGINFILE@@/${imageName}" alt="Oscillogramme ${row.id}" style="max-width:100%;height:auto"></p>
<table>${values.map(([label, value, tolerance]) => `<tr><td>${label}</td><td>${numericalAnswer(value, tolerance)}</td></tr>`).join("")}</table>`;
    const feedback = values.map(([label, value]) => `${label.slice(0, label.indexOf(" ("))} = ${number(value)} ${label.match(/\(([^)]+)\)/)[1]}`).join(" ; ") + ".";

    return `<question type="cloze">
<name><text>${xmlEscape(row.id)}</text></name>
<questiontext format="html">
<text><![CDATA[${cdata(body)}]]></text>
<file name="${xmlEscape(imageName)}" path="/" encoding="base64">${imageBase64}</file>
</questiontext>
<generalfeedback format="html"><text><![CDATA[${cdata(feedback)}]]></text></generalfeedback>
<defaultgrade>4.0000000</defaultgrade>
<penalty>0.3333333</penalty>
<hidden>0</hidden>
<idnumber>${xmlEscape(row.id)}</idnumber>
<tags><tag><text>oscilloscope</text></tag><tag><text>${xmlEscape(wave)}</text></tag><tag><text>${xmlEscape(row.niveau)}</text></tag></tags>
</question>`;
}

function bankXml(rows, level, wave) {
    const category = { easy: "Easy", medium: "Medium", hard: "Hard" }[level];
    const categoryPath = wave === "sinus" ? `$course$/top/Oscilloscope/${category}` : `$course$/top/Oscilloscope/${wave === "carre" ? "Carré" : "Triangle"}/${category}`;
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<quiz>",
        `<question type="category"><category><text>${categoryPath}</text></category></question>`,
        ...rows.map(questionXml),
        "</quiz>",
        "",
    ].join("\n");
}

if (!fs.existsSync(csvPath)) throw new Error(`Inventaire introuvable : ${csvPath}`);
const rows = readInventory();
if (rows.length === 0) throw new Error("L’inventaire ne contient aucune question.");

fs.mkdirSync(outputDir, { recursive: true });
for (const wave of ["sinus", "triangle", "carre"]) for (const level of ["easy", "medium", "hard"]) {
    const selected = rows.filter(row => (row.signal || "sinus") === wave && row.niveau === level).slice(skipCount);
    if (selected.length === 0) continue;
    const size = chunkSize > 0 ? chunkSize : selected.length;
    for (let start = 0; start < selected.length; start += size) {
        const chunk = selected.slice(start, start + size);
        const suffix = chunkSize > 0 ? `-${String(start / size + 1).padStart(2, "0")}` : "";
        const name = wave === "sinus" ? `oscillo-${level}${suffix}.xml` : `oscillo-${wave}-${level}${suffix}.xml`;
        const target = path.join(outputDir, name);
        fs.writeFileSync(target, bankXml(chunk, level, wave), "utf8");
        console.log(`${wave} ${level}: ${chunk.length} questions -> ${target}`);
    }
}
