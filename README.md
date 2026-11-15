# Algoritmo genético para escolher projetos do campus

Trabalho de Inteligência Artificial (UFPI, 2026.2). É um simulador de algoritmo genético que roda no navegador e escolhe projetos de melhoria do campus, tentando maximizar o benefício total sem passar do orçamento.

- Aplicação: [https://EudesN.github.io/algoritmo-genetico/](https://eudesn.github.io/algoritmo-genetico/)
- Repositório: [https://github.com/EudesN/algoritmo-genetico](https://github.com/EudesN/algoritmo-genetico)

## Autores

- Francisco Eudes Andrade Nazário (20249021344)
- Bianca da Silva Magalhães Pinheiro (20249012612)
- Yuri da Silva Barbosa (20249021792)

## Como funciona

Cada solução é um cromossomo binário com um gene por projeto, na ordem da tabela (A, B, C...). O 1 seleciona o projeto e o 0 deixa de fora. Por exemplo, `1010` escolhe A e C.

O algoritmo está em `js/ga.js`:

- **População inicial:** cada gene é sorteado com 50% de chance de ser 0 ou 1. Depois o indivíduo é reparado e avaliado. Essa é a geração 0.
- **Avaliação:** calcula custo, benefício, saldo e se cabe no orçamento. A aptidão é o benefício da solução já reparada. Seleção vazia vale e tem aptidão 0.
- **Reparação:** enquanto o custo passar do orçamento, remove o projeto selecionado com a menor razão benefício/custo. Se houver empate, remove o de menor índice. Vale para a população inicial e para os filhos, antes de avaliar.
- **Torneio:** cada pai sai de um torneio independente, com candidatos diferentes entre si. Vence a maior aptidão e, no empate, o menor índice.
- **Cruzamento de um ponto:** a taxa vale por par de pais. O corte é sorteado entre o primeiro e o penúltimo gene. Sem cruzamento, os filhos são cópias dos pais.
- **Mutação:** cada gene de cada filho é invertido com probabilidade igual à taxa de mutação.
- **Elitismo:** os melhores indivíduos passam para a próxima geração sem mudanças. Com elite 0, ninguém é preservado.
- **Substituição:** o resto das vagas é preenchido com filhos, sempre com pais da população anterior. Se sobrar uma vaga só, fica o primeiro filho do último par. O tamanho da população não muda e indivíduos repetidos são permitidos.
- **Parada:** depois do número de gerações configurado. O resultado final é a melhor solução de toda a execução, contando a geração 0.

Ordem dos sorteios em cada par: torneio do pai 1, torneio do pai 2, decisão de cruzar, ponto de corte (se cruzar), genes do filho 1 e genes do filho 2.

Dinheiro é guardado em centavos e benefício em centésimos, sempre como inteiros, para não ter erro de ponto flutuante. A razão benefício/custo é comparada por multiplicação cruzada com `BigInt`, sem divisão.

O gerador aleatório é o Mulberry32, escrito em `ga.js`. Com a mesma semente, os mesmos dados e os mesmos parâmetros, a execução se repete igual.

## O que a tela mostra

- Geração atual, melhor aptidão da geração, aptidão média e melhor resultado acumulado.
- A melhor solução com cromossomo, projetos escolhidos, custo, benefício e saldo.
- Gráfico de evolução, histórico por geração e tabela da população atual.
- Log de texto de cada geração, que pode ser baixado. Ele registra os torneios, os pais, o corte, os filhos, os bits mutados, cada passo da reparação, a elite e onde cada filho entrou. Exemplo da geração 1 com a semente 42:

  > Par 4: torneio 1 [#12 1100 (12), #17 0100 (5)] → #12; torneio 2 [#18 0010 (3), #4 0011 (11)] → #4. Pais: 1100 e 0011; corte após o 2º gene (11|00 + 00|11); filhos: 1111 e 0000; mutação no gene 2 do filho 1: 1111 → 1011; mutação no gene 4 do filho 2: 0000 → 0001; reparação do filho 1: 1011 → 1001 → 1000 (remove C e D); resultado: filho 1 = 1000 (custo R$ 4.000,00, aptidão 7) → indivíduo #7; filho 2 = 0001 (custo R$ 5.000,00, aptidão 8) → indivíduo #8.

- Animação com os eventos que o algoritmo registrou, em cinco fases:
  1. Torneio: candidatos em destaque e vencedor em verde.
  2. Cruzamento: os cromossomos se separam no corte e os segmentos são trocados (azul é o pai 1, laranja é o pai 2).
  3. Mutação: os bits invertidos ficam vermelhos.
  4. Reparação: o projeto removido é riscado, com a razão benefício/custo e o custo antes e depois.
  5. Avaliação e inserção, com a elite em dourado.

  Dá para animar só o primeiro par ou todos, mudar a velocidade, pular e reproduzir qualquer par da última geração.

## Como usar

1. Abra a página. Ela começa com o exemplo da seção 6.1 do enunciado (4 projetos, orçamento de R$ 7.000).
2. Edite, adicione ou remova projetos (de 4 a 15) e ajuste os parâmetros. Campo inválido fica vermelho e bloqueia a execução.
3. Qualquer mudança nos dados ou nos parâmetros exige clicar em Reiniciar, que apaga o histórico, volta à semente e cria a geração 0.
4. Botões:
   - Executar: roda até o limite de gerações ou retoma depois de uma pausa.
   - Pausar: guarda o estado.
   - Avançar uma geração: faz uma geração e continua pausado.
   - Reiniciar: volta à geração 0.
5. Para rodar na própria máquina, abra o `index.html` no navegador ou use `python3 -m http.server` dentro da pasta.
6. Os testes rodam no botão "Executar testes" da página ou com `node tests/run-tests.js`. Com `--log`, mostra também o log e o histórico da execução 6.5.

## Parâmetros

| Campo | Valor inicial | Regra |
|---|---|---|
| Projetos | dados da seção 6.1 | nome não vazio, custo maior que 0, benefício maior ou igual a 0, até 2 casas decimais, de 4 a 15 projetos |
| Orçamento (R$) | 7000 | número maior ou igual a 0, até 2 casas decimais |
| Tamanho da população | 20 | inteiro a partir de 2 (máximo de 100000 para o navegador não travar) |
| Número de gerações | 50 | inteiro a partir de 1 (máximo de 100000); a população inicial é a geração 0 |
| Taxa de cruzamento (%) | 80 | de 0 a 100, por par |
| Taxa de mutação (%) | 5 | de 0 a 100, por gene |
| Tamanho do torneio | 2 | inteiro de 2 até o tamanho da população |
| Indivíduos de elite | 1 | inteiro de 0 até a população menos 1 |
| Semente | 42 | qualquer inteiro |

Os decimais aceitam vírgula ou ponto, sem separador de milhar (`4000` ou `4000,50`). Campo vazio não é aceito.

## Tecnologias e bibliotecas

HTML, CSS e JavaScript puro, rodando no navegador. Não usei nenhuma biblioteca externa. O algoritmo, o gerador de números aleatórios, o gráfico (canvas) e as animações foram feitos no próprio projeto.

## Arquivos

```
index.html          página
css/style.css       estilos
js/ga.js            algoritmo genético e textos do log
js/tests.js         testes da seção 6
js/app.js           interface, validação, controles, gráfico e animação
tests/run-tests.js  roda os testes pelo terminal
```

## Resultados dos testes

Rodei tudo com `node tests/run-tests.js` e também pelo botão da página. Os 9 testes passaram.

### 6.2 Avaliação de uma solução

Entrada: `1100` com orçamento de R$ 7.000. Saída: projetos A e B, custo R$ 7.000, benefício 12, saldo R$ 0, viável, aptidão 12.

Também enumerei os 16 cromossomos. Só os 9 do enunciado são viáveis (`0000, 0001, 0010, 0011, 0100, 0110, 1000, 1010, 1100`) e todos têm o mesmo custo e benefício da tabela do enunciado. A avaliação está correta.

### 6.3 Reparação de `1111`

| Passo | Cromossomo | Custo | Benefício | O que aconteceu |
|---|---|---|---|---|
| 0 | 1111 | R$ 14.000 | 23 | |
| 1 | 1101 | R$ 12.000 | 20 | remove C (3/2000 = 1,5 ponto por mil reais) |
| 2 | 1100 | R$ 7.000 | 12 | remove D (8/5000 = 1,6 ponto por mil reais), fica viável |

A saída é igual à do enunciado.

### 6.4 Operadores com escolhas controladas

- Cruzamento: `11|00 + 00|11` dá filho 1 = `1111` e filho 2 = `0000`.
- Mutação só no primeiro gene do filho 1: filho 1 = `0111` e filho 2 = `0000`.
- Reparação: o filho 1 vai de `0111` para `0101` e depois `0100` (remove C e depois D). O filho 2 continua `0000`.
- Avaliação: filho 1 = `0100`, custo R$ 3.000, aptidão 5. Filho 2 = `0000`, custo R$ 0, aptidão 0.
- Mutação 0% não inverteu nenhum gene em 500 cromossomos. Mutação 100% inverteu todos, tanto nos 500 cromossomos isolados quanto dentro do algoritmo.
- Cruzamento 0% fez os filhos copiarem os pais. Com 100%, todo par foi cruzado e o corte caiu sempre depois do gene 1, 2 ou 3.
- Torneio com 1000 (7), 0011 (11) e 1100 (12): vence o 1100. Com três candidatos de aptidão 8 (índices 4, 2 e 1), vence o índice 1. Em 1000 sorteios os candidatos nunca se repetiram.

Os operadores bateram com os valores de referência.

### 6.5 Execução completa

Dados da 6.1, população 20, 50 gerações, cruzamento 80%, mutação 5%, torneio 2, 1 de elite e semente 42.

| Resultado | Valor |
|---|---|
| Melhor cromossomo | 1100 (projetos A e B) |
| Custo | R$ 7.000,00 |
| Benefício | 12 |
| Saldo | R$ 0,00 |
| Encontrado na | geração 0 |
| Registros no histórico | 51 (gerações 0 a 50) |

Algumas gerações (melhor da geração, média, melhor acumulado):

| Geração | Melhor | Média | Acumulado |
|---|---|---|---|
| 0 | 12 | 7,60 | 12 |
| 1 | 12 | 9,45 | 12 |
| 5 | 12 | 11,35 | 12 |
| 10 | 12 | 12,00 | 12 |
| 20 | 12 | 12,00 | 12 |
| 30 | 12 | 11,75 | 12 |
| 40 | 12 | 11,50 | 12 |
| 50 | 12 | 11,15 | 12 |

O histórico completo aparece na página e no `node tests/run-tests.js --log`.

Conferências que passaram: o melhor acumulado nunca diminui, com 1 de elite a melhor aptidão da população nunca diminui, a solução final cabe no orçamento e os totais batem com o cromossomo, a população manteve o tamanho e repetir a semente reproduz exatamente o mesmo histórico.

O algoritmo achou o ótimo `1100`. A média sobe de 7,6 para perto de 11 ou 12 e oscila por causa do cruzamento e da mutação, enquanto a elite garante que o melhor não se perde.

### Mutação de 1% contra 20%

Mesmos parâmetros da 6.5, cinco execuções por taxa (sementes 1 a 5).

| Mutação | Melhor final nas sementes 1 a 5 | Média do melhor final | Execuções com 12 | Média da aptidão média na geração 50 |
|---|---|---|---|---|
| 1% | 12, 12, 12, 12, 12 | 12 | 5 de 5 | 11,95 |
| 20% | 12, 12, 12, 12, 12 | 12 | 5 de 5 | 9,48 |

As duas taxas chegaram ao ótimo em todas as execuções, quase sempre na geração 0. O motivo é que o problema é muito pequeno: só existem 2⁴ = 16 cromossomos e quatro deles (`1100`, `1101`, `1110` e `1111`) viram `1100` depois da reparação. Cada indivíduo sorteado tem 25% de chance de virar o ótimo, e a chance de nenhum dos 20 iniciais virar é 0,75²⁰, uns 0,3%. Por isso o melhor resultado final não separa as duas taxas.

A diferença aparece na população. Com 1%, ela converge: a média na geração 50 é 11,95 e quase todo mundo vira `1100`, o que significa pouca diversidade. Com 20%, cerca de 0,8 gene por filho é invertido e a média cai para 9,48, porque muitos filhos pioram. A mutação alta explora mais o espaço de busca, e o elitismo impede que o melhor se perca.

Em problemas maiores, uma taxa baixa pode prender a busca num ótimo local por falta de diversidade, e uma taxa alta pode deixar a busca quase aleatória. Nenhuma das duas é melhor sempre, e não dá para concluir isso com uma instância tão pequena.

### 6.6 Limites de orçamento

- Orçamento R$ 0: a população inicial reparada é toda `0000`, com custo, benefício e aptidão 0. As 51 gerações só têm `0000`.
- Orçamento R$ 14.000: `1111` é viável, com custo R$ 14.000, benefício 23 e saldo R$ 0, sem reparação. Na execução completa com a semente 42, o algoritmo achou `1111`.

### Testes extras

- Elite 0 com população 5: três pares preenchem as 5 vagas, o último par mantém só o primeiro filho e a população continua com 5.
- Elite 3: os 3 melhores (empate pelo menor índice) são copiados sem mudança para as posições 0 a 2.

A mesma semente não dá o mesmo resultado em implementações diferentes, porque o gerador e a ordem dos sorteios mudam a execução. Os números acima são os desta implementação.
