const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+"/passengerContact.ts","utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsForTest});
const {passengerContact} = exportsForTest;
test("school calls guardian, not child",()=>{
  const c = passengerContact("okul",{phone:"05001112233",parentPhone:"+90 (532) 111 22 33"});
  assert.equal(c.uri,"tel:+905321112233");
  assert.equal(c.label,"Veliyi ara");
});
test("school missing guardian never falls back to child",()=>assert.equal(passengerContact("okul",{phone:"05001112233"}),null));
test("personnel uses own number, never guardian",()=>{
  assert.equal(passengerContact("personel",{phone:"0532 111 22 33",parentPhone:"05001112233"}).uri,"tel:05321112233");
  assert.equal(passengerContact("personel",{parentPhone:"05001112233"}),null);
});
test("invalid numbers and dial codes cannot be launched",()=>{
  for(const phone of ["","123","*123#","05321112233;123","tel:05321112233"]) assert.equal(passengerContact("personel",{phone}),null);
});
