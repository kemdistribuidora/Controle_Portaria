import test from 'node:test';
import assert from 'node:assert/strict';
import { criarContexto, criarAbaFalsa } from './helpers/mockGas.mjs';

const ABA_FROTA = 'Movimentacao Frota';
const ABA_ACESSO = 'Controle Acesso';
const js = v => JSON.parse(JSON.stringify(v)); // objetos do vm são de outro realm

const CF = { DATA: 1, FROTA: 2, PLACA: 3, HORA_SAIDA: 4, KM_SAIDA: 5, TEMP_SAIDA: 6, HORA_RETORNO: 7, KM_RETORNO: 8, TEMP_RETORNO: 9, KM_RODADO: 10, OBS: 11, ATUALIZADO: 12 };
const CA = { DATA: 1, TIPO: 2, NOME: 3, EMPRESA: 4, NOTA: 5, PLACA: 6, CHEGADA: 7, SAIDA: 8, PERMANENCIA: 9, OBS: 10, ATUALIZADO: 11 };

/** Contexto com as duas abas já com cabeçalho na linha 1. */
function contextoComAbas({ frota = [], acesso = [], lockFalha = false } = {}) {
  const abas = {
    [ABA_FROTA]: criarAbaFalsa({ nome: ABA_FROTA, existente: [['Data'], ...frota] }),
    [ABA_ACESSO]: criarAbaFalsa({ nome: ABA_ACESSO, existente: [['Data'], ...acesso] }),
  };
  return { abas, ctx: criarContexto({ abas, lockFalha }) };
}

// ---------- Formatos ----------
test('normalizarData aceita dd/mm/aaaa e Date, rejeita lixo', () => {
  const ctx = criarContexto();
  assert.equal(ctx.normalizarData('5/7/2026'), '05/07/2026');
  assert.equal(ctx.normalizarData(new Date(2026, 6, 15)), '15/07/2026');
  assert.equal(ctx.normalizarData('lixo'), '');
});

test('normalizarHora aceita HH:mm e HH:mm:ss, rejeita invalida', () => {
  const ctx = criarContexto();
  assert.equal(ctx.normalizarHora('8:05'), '08:05');
  assert.equal(ctx.normalizarHora('18:30:00'), '18:30');
  assert.equal(ctx.normalizarHora('24:00'), '');
  assert.equal(ctx.normalizarHora(''), '');
});

test('normalizarKm aceita inteiro e rejeita lixo', () => {
  const ctx = criarContexto();
  assert.equal(ctx.normalizarKm('123456'), 123456);
  assert.equal(ctx.normalizarKm(0), 0);
  assert.equal(ctx.normalizarKm(' 12 '), 12);
  assert.equal(ctx.normalizarKm(''), '');
  assert.equal(ctx.normalizarKm('-3'), '');
  assert.equal(ctx.normalizarKm('1.5'), '');
  assert.equal(ctx.normalizarKm('12345678'), '');
});

test('normalizarTemp aceita negativo, virgula e ponto', () => {
  const ctx = criarContexto();
  assert.equal(ctx.normalizarTemp('-18'), -18);
  assert.equal(ctx.normalizarTemp('-18,5'), -18.5);
  assert.equal(ctx.normalizarTemp('4.0'), 4);
  assert.equal(ctx.normalizarTemp('2,25'), 2.3);
  assert.equal(ctx.normalizarTemp('-0'), 0);
  assert.equal(ctx.normalizarTemp(''), '');
  assert.equal(ctx.normalizarTemp('-'), '');
  assert.equal(ctx.normalizarTemp('abc'), '');
  assert.equal(ctx.normalizarTemp('150'), '');
});

test('normalizarPlaca deixa so letras/numeros maiusculos', () => {
  const ctx = criarContexto();
  assert.equal(ctx.normalizarPlaca('abc-1d23'), 'ABC1D23');
  assert.equal(ctx.normalizarPlaca(''), '');
});

test('calcularKmRodado e calcularDuracao', () => {
  const ctx = criarContexto();
  assert.equal(ctx.calcularKmRodado(1000, 1250), 250);
  assert.equal(ctx.calcularKmRodado(1000, ''), '');
  assert.equal(ctx.calcularKmRodado(1000, 900), '');
  assert.equal(ctx.calcularDuracao('08:00', '09:15'), '1:15');
  assert.equal(ctx.calcularDuracao('23:50', '00:10'), '0:20');
  assert.equal(ctx.calcularDuracao('08:00', ''), '');
});

// ---------- Config ----------
test('getConfig devolve frota com placas, tipos e os dois grids', () => {
  const ctx = criarContexto();
  const cfg = ctx.getConfig();
  assert.equal(cfg.frota.length, 23);
  assert.deepEqual(js(cfg.frota[0]), { numero: 16, placa: 'IZP3F14' });
  assert.deepEqual(js(cfg.frota[22]), { numero: 38, placa: 'TRJ5J92' });
  assert.deepEqual(js(cfg.tipos.map(t => t.id)), ['cliente', 'fornecedor', 'visita', 'colaborador', 'prestador']);
  assert.deepEqual(js(cfg.grids.map(g => g.nome)), ['Movimentação Frota', 'Controle Acesso']);
  assert.match(cfg.hoje, /^\d{2}\/\d{2}\/\d{4}$/);
});

test('acharGrid e acharTipo por id ou nome', () => {
  const ctx = criarContexto();
  assert.equal(ctx.acharGrid('frota').aba, ABA_FROTA);
  assert.equal(ctx.acharGrid(ABA_ACESSO).id, 'acesso');
  assert.equal(ctx.acharGrid('x'), null);
  assert.equal(ctx.acharTipo('Fornecedor').id, 'fornecedor');
  assert.equal(ctx.acharTipo('VISITA').id, 'visita');
  assert.equal(ctx.acharTipo(''), null);
});

// ---------- Compacto ----------
test('registrosDeCompacto frota vira mapa por caminhao', () => {
  const ctx = criarContexto();
  const r = ctx.registrosDeCompacto('frota', JSON.stringify([[16, '06:00', 1000, '-18', '15:00', 1200, '-15', 'ok']]));
  assert.equal(r['16'].hora_saida, '06:00');
  assert.equal(r['16'].km_retorno, 1200);
  assert.equal(r['16'].obs, 'ok');
});

test('registrosDeCompacto acesso vira lista na ordem', () => {
  const ctx = criarContexto();
  const r = ctx.registrosDeCompacto('acesso', JSON.stringify([
    ['cliente', 'João', 'Mercado X', '123', 'ABC1D23', '08:00', '08:30', ''],
    ['visita', 'Ana', 'Contab', '', '', '09:00', '', 'Reunião'],
  ]));
  assert.equal(r.length, 2);
  assert.equal(r[0].empresa, 'Mercado X');
  assert.equal(r[1].obs, 'Reunião');
  assert.deepEqual(ctx.registrosDeCompacto('acesso', '').length, 0);
});

// ---------- Abas ----------
test('prepararAbas cria as duas abas com cabecalho na linha 1', () => {
  const abas = {};
  const ctx = criarContexto({ abas });
  const nomes = ctx.prepararAbas();
  assert.deepEqual(Array.from(nomes), [ABA_FROTA, ABA_ACESSO]);
  assert.equal(abas[ABA_FROTA].getRange(1, 1, 1, 12).getValues()[0][9], 'KM rodado');
  assert.equal(abas[ABA_ACESSO].getRange(1, 1, 1, 11).getValues()[0][8], 'Permanência');
});

// ---------- Movimentação Frota ----------
test('carregarDia frota preenche todos os caminhoes mesmo sem lancamento', () => {
  const { ctx } = contextoComAbas();
  const r = ctx.carregarDia('15/07/2026', 'frota');
  assert.equal(r.temDados, false);
  assert.equal(Object.keys(r.registros).length, 23);
  assert.equal(r.registros['16'].hora_saida, '');
});

test('salvarDia frota grava placa, KM rodado e so caminhoes preenchidos', () => {
  const { abas, ctx } = contextoComAbas();
  const r = ctx.salvarDia({
    data: '15/07/2026', grid: 'frota',
    registros: {
      20: { hora_saida: '06:10', km_saida: '50000', temp_saida: '-18,5', hora_retorno: '14:00', km_retorno: '50230', temp_retorno: '-12' },
      16: { hora_saida: '05:30', km_saida: 1000 },
      17: {},
    },
  });
  assert.equal(r.ok, true);
  assert.match(r.mensagem, /2 lançamento\(s\) salvos/);
  const aba = abas[ABA_FROTA];
  assert.equal(aba.getLastRow(), 3);
  const l1 = aba.getRange(2, 1, 1, 12).getValues()[0];
  const l2 = aba.getRange(3, 1, 1, 12).getValues()[0];
  assert.equal(l1[CF.FROTA - 1], 16);                 // ordenado por caminhão
  assert.equal(l1[CF.KM_RODADO - 1], '');             // sem retorno ainda
  assert.equal(l2[CF.PLACA - 1], 'JBO7A46');
  assert.equal(l2[CF.TEMP_SAIDA - 1], -18.5);
  assert.equal(l2[CF.KM_RODADO - 1], 230);
});

test('salvarDia frota e carregarDia ida e volta', () => {
  const { ctx } = contextoComAbas();
  ctx.salvarDia({ data: '15/07/2026', grid: 'frota', registros: { 33: { hora_saida: '07:00', km_saida: 9, temp_saida: '3', obs: 'Carregado' } } });
  const r = ctx.carregarDia('15/07/2026', 'frota');
  assert.equal(r.temDados, true);
  assert.equal(r.registros['33'].km_saida, 9);
  assert.equal(r.registros['33'].temp_saida, 3);
  assert.equal(r.registros['33'].obs, 'Carregado');
});

test('salvarDia frota preserva outros dias e limpa sobra do mesmo dia', () => {
  const outro = []; outro[CF.DATA - 1] = '14/07/2026'; outro[CF.FROTA - 1] = '18'; outro[CF.HORA_SAIDA - 1] = '06:00';
  const mesmo1 = []; mesmo1[CF.DATA - 1] = '15/07/2026'; mesmo1[CF.FROTA - 1] = '19'; mesmo1[CF.HORA_SAIDA - 1] = '06:00';
  const mesmo2 = []; mesmo2[CF.DATA - 1] = '15/07/2026'; mesmo2[CF.FROTA - 1] = '20'; mesmo2[CF.HORA_SAIDA - 1] = '06:00';
  const { abas, ctx } = contextoComAbas({ frota: [outro, mesmo1, mesmo2] });
  ctx.salvarDia({ data: '15/07/2026', grid: 'frota', registros: { 21: { hora_saida: '07:00', km_saida: 1 } } });
  const aba = abas[ABA_FROTA];
  assert.equal(aba.getLastRow(), 3);
  assert.equal(aba.getRange(2, CF.FROTA).getValue(), 18);
  assert.equal(aba.getRange(3, CF.FROTA).getValue(), 21);
});

test('salvarDia frota nao mexe na aba Controle Acesso', () => {
  const ac = []; ac[CA.DATA - 1] = '15/07/2026'; ac[CA.TIPO - 1] = 'Visita'; ac[CA.NOME - 1] = 'Ana';
  const { abas, ctx } = contextoComAbas({ acesso: [ac] });
  ctx.salvarDia({ data: '15/07/2026', grid: 'frota', registros: {} });
  assert.equal(abas[ABA_ACESSO].getRange(2, CA.NOME).getValue(), 'Ana');
});

// ---------- Controle Acesso ----------
test('salvarDia acesso grava tipos, permanencia, ordena por chegada e ignora linha vazia', () => {
  const { abas, ctx } = contextoComAbas();
  const r = ctx.salvarDia({
    data: '15/07/2026', grid: 'acesso',
    registros: [
      { tipo: 'visita', nome: 'Ana', empresa: 'Contab', chegada: '10:00', saida: '11:30', obs: 'Reunião' },
      { tipo: 'cliente', nome: 'João', empresa: 'Mercado X', nota: '123, 124', placa: 'abc-1d23', chegada: '08:00', saida: '08:45' },
      { tipo: 'fornecedor' },
      { tipo: 'fornecedor', empresa: 'Laticínios Y', nota: 'não deve gravar', chegada: '09:00' },
    ],
  });
  assert.equal(r.ok, true);
  assert.match(r.mensagem, /3 lançamento\(s\) salvos/);
  const aba = abas[ABA_ACESSO];
  const linhas = aba.getRange(2, 1, 3, 11).getValues();
  assert.deepEqual(js(linhas.map(l => l[CA.TIPO - 1])), ['Cliente', 'Fornecedor', 'Visita']);
  assert.equal(linhas[0][CA.PLACA - 1], 'ABC1D23');
  assert.equal(linhas[0][CA.NOTA - 1], '123, 124');
  assert.equal(linhas[0][CA.PERMANENCIA - 1], '0:45');
  assert.equal(linhas[1][CA.NOTA - 1], '');          // nota só para cliente
  assert.equal(linhas[1][CA.PERMANENCIA - 1], '');   // ainda no local
  assert.equal(linhas[2][CA.PERMANENCIA - 1], '1:30');
});

test('carregarDia acesso devolve lista com id do tipo', () => {
  const { ctx } = contextoComAbas();
  ctx.salvarDia({ data: '15/07/2026', grid: 'acesso', registros: [{ tipo: 'cliente', empresa: 'Mercado X', nota: '9', chegada: '08:00' }] });
  const r = ctx.carregarDia('15/07/2026', 'acesso');
  assert.equal(r.temDados, true);
  assert.equal(r.registros.length, 1);
  assert.equal(r.registros[0].tipo, 'cliente');
  assert.equal(r.registros[0].chegada, '08:00');
  assert.equal(ctx.carregarDia('16/07/2026', 'acesso').registros.length, 0);
});

test('salvarDia acesso regravando o dia substitui, sem duplicar', () => {
  const { abas, ctx } = contextoComAbas();
  const reg = [{ tipo: 'visita', nome: 'Ana', empresa: 'X', chegada: '08:00' }, { tipo: 'visita', nome: 'Bia', empresa: 'Y', chegada: '09:00' }];
  ctx.salvarDia({ data: '15/07/2026', grid: 'acesso', registros: reg });
  ctx.salvarDia({ data: '15/07/2026', grid: 'acesso', registros: [Object.assign({}, reg[0], { saida: '08:30' })] });
  const aba = abas[ABA_ACESSO];
  assert.equal(aba.getLastRow(), 2);
  assert.equal(aba.getRange(2, CA.SAIDA).getValue(), '08:30');
});

// ---------- Validações de salvarDia ----------
test('salvarDia rejeita data e grid invalidos', () => {
  const { ctx } = contextoComAbas();
  assert.match(ctx.salvarDia({ data: 'lixo', grid: 'frota', registros: {} }).mensagem, /Data inválida/);
  assert.match(ctx.salvarDia({ data: '15/07/2026', grid: 'x', registros: {} }).mensagem, /Grid inválido/);
});

test('salvarDia com lock ocupado devolve mensagem amigavel', () => {
  const { ctx } = contextoComAbas({ lockFalha: true });
  const r = ctx.salvarDia({ data: '15/07/2026', grid: 'frota', registros: {} });
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /Outra pessoa está salvando/);
});

// ---------- doGet / doPost ----------
test('doGet acao=ping responde ok, com e sem callback', () => {
  const ctx = criarContexto();
  const saida = ctx.doGet({ parameter: { acao: 'ping' } });
  assert.equal(JSON.parse(saida._texto).dados, 'pong');
  assert.equal(saida._mime, 'JSON');
  const jsonp = ctx.doGet({ parameter: { acao: 'ping', callback: 'cb;alert(1)' } });
  assert.match(jsonp._texto, /^cbalert1\(/);
  assert.equal(jsonp._mime, 'JAVASCRIPT');
});

test('doGet acao=salvar grava acesso e responde numa unica ida', () => {
  const { abas, ctx } = contextoComAbas();
  const dados = JSON.stringify([['fornecedor', '', 'Laticínios Y', '', '', '09:00', '', '']]);
  const corpo = JSON.parse(ctx.doGet({ parameter: { acao: 'salvar', data: '15/07/2026', grid: 'acesso', dados } })._texto);
  assert.equal(corpo.ok, true);
  assert.equal(abas[ABA_ACESSO].getRange(2, CA.EMPRESA).getValue(), 'Laticínios Y');
});

test('doGet acao=salvar grava frota', () => {
  const { abas, ctx } = contextoComAbas();
  const dados = JSON.stringify([[25, '06:00', 100, '', '', '', '', '']]);
  const corpo = JSON.parse(ctx.doGet({ parameter: { acao: 'salvar', data: '15/07/2026', grid: 'frota', dados } })._texto);
  assert.equal(corpo.ok, true);
  assert.equal(abas[ABA_FROTA].getRange(2, CF.PLACA).getValue(), 'JCR1B70');
});

test('doGet sem acao devolve config + dia de hoje do grid', () => {
  const { ctx } = contextoComAbas();
  const corpo = JSON.parse(ctx.doGet({ parameter: { grid: 'acesso' } })._texto);
  assert.equal(corpo.ok, true);
  assert.ok(corpo.dados.config);
  assert.equal(corpo.dados.dia.grid, 'acesso');
  assert.deepEqual(corpo.dados.dia.registros, []);
});

test('doGet acao=dia com grid desconhecido devolve ok:false sem lancar', () => {
  const ctx = criarContexto();
  const corpo = JSON.parse(ctx.doGet({ parameter: { acao: 'dia', data: '15/07/2026', grid: 'nao-existe' } })._texto);
  assert.equal(corpo.ok, false);
  assert.match(corpo.mensagem, /^Erro:/);
});

test('doPost grava payload e responde sucesso; JSON invalido devolve erro', () => {
  const { ctx } = contextoComAbas();
  const payload = JSON.stringify({ data: '15/07/2026', grid: 'acesso', registros: [{ tipo: 'visita', nome: 'Ana', chegada: '08:00' }] });
  assert.equal(JSON.parse(ctx.doPost({ postData: { contents: payload } })._texto).ok, true);
  assert.equal(JSON.parse(ctx.doPost({ postData: { contents: '{invalido' } })._texto).ok, false);
  assert.equal(JSON.parse(ctx.doPost({})._texto).ok, false);
});
