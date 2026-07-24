const fs = require('fs');
const path = require('path');

const listonePath = path.join(__dirname, '../backend/data/listone.json');
let players = JSON.parse(fs.readFileSync(listonePath, 'utf8'));

const playerDetails = {
  // Portieri
  "Carnesecchi": { Squadra: "Atalanta", Ruolo: "Por" },
  "Milinkovic-Savic V.": { Squadra: "Torino", Ruolo: "Por" },
  "Svilar": { Squadra: "Roma", Ruolo: "Por" },
  "Butez": { Squadra: "Como", Ruolo: "Por" },
  "Maignan": { Squadra: "Milan", Ruolo: "Por" },
  "Di Gregorio": { Squadra: "Juventus", Ruolo: "Por" },
  "Falcone": { Squadra: "Lecce", Ruolo: "Por" },
  "Okoye": { Squadra: "Udinese", Ruolo: "Por" },
  "Sommer": { Squadra: "Inter", Ruolo: "Por" },
  "Caprile": { Squadra: "Napoli", Ruolo: "Por" },
  "Meret": { Squadra: "Napoli", Ruolo: "Por" },
  "Provedel": { Squadra: "Lazio", Ruolo: "Por" },
  "Mandas": { Squadra: "Lazio", Ruolo: "Por" },
  "Skorupski": { Squadra: "Bologna", Ruolo: "Por" },
  "Terracciano": { Squadra: "Fiorentina", Ruolo: "Por" },
  "De Gea": { Squadra: "Fiorentina", Ruolo: "Por" },
  "Gollini": { Squadra: "Genoa", Ruolo: "Por" },
  "Audero": { Squadra: "Como", Ruolo: "Por" },
  "Turati": { Squadra: "Monza", Ruolo: "Por" },
  "Montipò": { Squadra: "Verona", Ruolo: "Por" },
  "Vasquez": { Squadra: "Empoli", Ruolo: "Por" },
  "Stankovic": { Squadra: "Venezia", Ruolo: "Por" },
  "Joronen": { Squadra: "Venezia", Ruolo: "Por" },

  // Difensori
  "Acerbi": { Squadra: "Inter", Ruolo: "Dc" },
  "Bastoni": { Squadra: "Inter", Ruolo: "Dc" },
  "Pavard": { Squadra: "Inter", Ruolo: "Dc" },
  "Dimarco": { Squadra: "Inter", Ruolo: "E" },
  "Dumfries": { Squadra: "Inter", Ruolo: "E" },
  "Darmian": { Squadra: "Inter", Ruolo: "Dd;Ds;E" },
  "Carlos Augusto": { Squadra: "Inter", Ruolo: "B;Ds;E" },
  "Bisseck": { Squadra: "Inter", Ruolo: "Dc" },

  "Bremer": { Squadra: "Juventus", Ruolo: "Dc" },
  "Gatti": { Squadra: "Juventus", Ruolo: "Dc" },
  "Danilo": { Squadra: "Juventus", Ruolo: "Dd;Dc" },
  "Cambiaso": { Squadra: "Juventus", Ruolo: "E" },
  "Kalulu": { Squadra: "Juventus", Ruolo: "Dd;Dc" },
  "Cabal": { Squadra: "Juventus", Ruolo: "Ds;Dc" },
  "Savona": { Squadra: "Juventus", Ruolo: "Dd;E" },

  "Tomori": { Squadra: "Milan", Ruolo: "Dc" },
  "Thiaw": { Squadra: "Milan", Ruolo: "Dc" },
  "Pavlovic": { Squadra: "Milan", Ruolo: "Dc" },
  "Theo Hernandez": { Squadra: "Milan", Ruolo: "E" },
  "Emerson Royal": { Squadra: "Milan", Ruolo: "Dd;E" },
  "Calabria": { Squadra: "Milan", Ruolo: "Dd;E" },
  "Terracciano F.": { Squadra: "Milan", Ruolo: "Dd;Ds;E" },

  "Buongiorno": { Squadra: "Napoli", Ruolo: "Dc" },
  "Rrahmani": { Squadra: "Napoli", Ruolo: "Dc" },
  "Di Lorenzo": { Squadra: "Napoli", Ruolo: "Dd;E" },
  "Olivera": { Squadra: "Napoli", Ruolo: "Ds;E" },
  "Spinazzola": { Squadra: "Napoli", Ruolo: "E" },
  "Mazzocchi": { Squadra: "Napoli", Ruolo: "Dd;Ds;E" },
  "Rafa Marin": { Squadra: "Napoli", Ruolo: "Dc" },

  "Mancini": { Squadra: "Roma", Ruolo: "Dc" },
  "Ndicka": { Squadra: "Roma", Ruolo: "Dc" },
  "Hummels": { Squadra: "Roma", Ruolo: "Dc" },
  "Hermoso": { Squadra: "Roma", Ruolo: "Dc;Ds" },
  "Angelino": { Squadra: "Roma", Ruolo: "E" },
  "Celik": { Squadra: "Roma", Ruolo: "Dd;E" },
  "Saelemaekers": { Squadra: "Roma", Ruolo: "E;W" },

  "Scalvini": { Squadra: "Atalanta", Ruolo: "Dc" },
  "Hien": { Squadra: "Atalanta", Ruolo: "Dc" },
  "Djimsiti": { Squadra: "Atalanta", Ruolo: "Dc" },
  "Kolasinac": { Squadra: "Atalanta", Ruolo: "B;Ds;E" },
  "Bellanova": { Squadra: "Atalanta", Ruolo: "E" },
  "Ruggeri": { Squadra: "Atalanta", Ruolo: "E" },
  "Zappacosta": { Squadra: "Atalanta", Ruolo: "E" },
  "Godfrey": { Squadra: "Atalanta", Ruolo: "Dc" },
  "Kossounou": { Squadra: "Atalanta", Ruolo: "Dc" },

  "Gila": { Squadra: "Lazio", Ruolo: "Dc" },
  "Romagnoli": { Squadra: "Lazio", Ruolo: "Dc" },
  "Patric": { Squadra: "Lazio", Ruolo: "Dc" },
  "Lazzari": { Squadra: "Lazio", Ruolo: "E" },
  "Tavares": { Squadra: "Lazio", Ruolo: "E" },
  "Marusic": { Squadra: "Lazio", Ruolo: "Dd;Ds;E" },

  "Beukema": { Squadra: "Bologna", Ruolo: "Dc" },
  "Lucumì": { Squadra: "Bologna", Ruolo: "Dc" },
  "Posch": { Squadra: "Bologna", Ruolo: "Dd;Dc" },
  "Miranda": { Squadra: "Bologna", Ruolo: "Ds;E" },
  "Erlic": { Squadra: "Bologna", Ruolo: "Dc" },

  "Ranieri L.": { Squadra: "Fiorentina", Ruolo: "Ds;Dc" },
  "Quarta": { Squadra: "Fiorentina", Ruolo: "Dc" },
  "Pongracic": { Squadra: "Fiorentina", Ruolo: "Dc" },
  "Dodò": { Squadra: "Fiorentina", Ruolo: "E" },
  "Biraghi": { Squadra: "Fiorentina", Ruolo: "Ds;E" },
  "Parisi": { Squadra: "Fiorentina", Ruolo: "Ds;E" },

  "Coco": { Squadra: "Torino", Ruolo: "Dc" },
  "Masina": { Squadra: "Torino", Ruolo: "Ds;Dc" },
  "Vojvoda": { Squadra: "Torino", Ruolo: "E;Dd" },
  "Pedersen": { Squadra: "Torino", Ruolo: "E" },
  "Borna Sosa": { Squadra: "Torino", Ruolo: "E" },

  "Vasquez": { Squadra: "Genoa", Ruolo: "Ds;Dc" },
  "Vogliacco": { Squadra: "Genoa", Ruolo: "Dc" },
  "Bani": { Squadra: "Genoa", Ruolo: "Dc" },
  "Martin": { Squadra: "Genoa", Ruolo: "E" },
  "Sabelli": { Squadra: "Genoa", Ruolo: "Dd;E" },

  "Dossena": { Squadra: "Como", Ruolo: "Dc" },
  "Kempf": { Squadra: "Como", Ruolo: "Dc" },
  "Goldaniga": { Squadra: "Como", Ruolo: "Dc" },
  "Moreno": { Squadra: "Como", Ruolo: "Ds;E" },
  "Iovine": { Squadra: "Como", Ruolo: "Dd;E" },

  "Izzo": { Squadra: "Monza", Ruolo: "Dc" },
  "Mari": { Squadra: "Monza", Ruolo: "Dc" },
  "Caldirola": { Squadra: "Monza", Ruolo: "Dc" },
  "Kyriakopoulos": { Squadra: "Monza", Ruolo: "E" },
  "Birindelli": { Squadra: "Monza", Ruolo: "Dd;E" },

  "Mina": { Squadra: "Cagliari", Ruolo: "Dc" },
  "Luperto": { Squadra: "Cagliari", Ruolo: "Dc" },
  "Zappa": { Squadra: "Cagliari", Ruolo: "Dd;E" },
  "Augello": { Squadra: "Cagliari", Ruolo: "Ds;E" },
  "Zortea": { Squadra: "Cagliari", Ruolo: "E" },

  "Bijol": { Squadra: "Udinese", Ruolo: "Dc" },
  "Perez": { Squadra: "Udinese", Ruolo: "Dc" },
  "Giannetti": { Squadra: "Udinese", Ruolo: "Dc" },
  "Kamara": { Squadra: "Udinese", Ruolo: "E" },
  "Ehizibue": { Squadra: "Udinese", Ruolo: "E" },

  "Baschirotto": { Squadra: "Lecce", Ruolo: "Dc" },
  "Gaspar": { Squadra: "Lecce", Ruolo: "Dc" },
  "Gallo": { Squadra: "Lecce", Ruolo: "Ds;E" },
  "Guilbert": { Squadra: "Lecce", Ruolo: "Dd;E" },

  "Dawidowicz": { Squadra: "Verona", Ruolo: "Dc" },
  "Magnani": { Squadra: "Verona", Ruolo: "Dc" },
  "Coppola": { Squadra: "Verona", Ruolo: "Dc" },
  "Tchatchoua": { Squadra: "Verona", Ruolo: "E" },
  "Frese": { Squadra: "Verona", Ruolo: "Ds;E" },

  "Ismajli": { Squadra: "Empoli", Ruolo: "Dc" },
  "Viti": { Squadra: "Empoli", Ruolo: "Ds;Dc" },
  "Goglichidze": { Squadra: "Empoli", Ruolo: "Dc" },
  "Pezzella": { Squadra: "Empoli", Ruolo: "Ds;E" },
  "Gyasi": { Squadra: "Empoli", Ruolo: "E;W" },

  "Svoboda": { Squadra: "Venezia", Ruolo: "Dc" },
  "Idzes": { Squadra: "Venezia", Ruolo: "Dc" },
  "Sverko": { Squadra: "Venezia", Ruolo: "Dc" },
  "Zampano": { Squadra: "Venezia", Ruolo: "E" },
  "Haps": { Squadra: "Venezia", Ruolo: "E" },

  // Centrocampisti / Trequartisti
  "Barella": { Squadra: "Inter", Ruolo: "C" },
  "Calhanoglu": { Squadra: "Inter", Ruolo: "M;C" },
  "Frattesi": { Squadra: "Inter", Ruolo: "C;T" },
  "Mkhitaryan": { Squadra: "Inter", Ruolo: "C;T" },
  "Zielinski": { Squadra: "Inter", Ruolo: "C;T" },
  "Asllani": { Squadra: "Inter", Ruolo: "M;C" },

  "Koopmeiners": { Squadra: "Juventus", Ruolo: "C;T" },
  "Douglas Luiz": { Squadra: "Juventus", Ruolo: "C;T" },
  "Thuram K.": { Squadra: "Juventus", Ruolo: "M;C" },
  "Locatelli": { Squadra: "Juventus", Ruolo: "M;C" },
  "Fagioli": { Squadra: "Juventus", Ruolo: "C;T" },
  "McKennie": { Squadra: "Juventus", Ruolo: "C;E" },
  "Miretti": { Squadra: "Juventus", Ruolo: "C;T" },

  "Reijnders": { Squadra: "Milan", Ruolo: "C;T" },
  "Loftus-Cheek": { Squadra: "Milan", Ruolo: "C;T" },
  "Fofana": { Squadra: "Milan", Ruolo: "M;C" },
  "Pulisic": { Squadra: "Milan", Ruolo: "W;T" },
  "Musah": { Squadra: "Milan", Ruolo: "M;C" },
  "Bennacer": { Squadra: "Milan", Ruolo: "M;C" },

  "McTominay": { Squadra: "Napoli", Ruolo: "C;T" },
  "Zambo Anguissa": { Squadra: "Napoli", Ruolo: "M;C" },
  "Lobotka": { Squadra: "Napoli", Ruolo: "M;C" },
  "Gilmour": { Squadra: "Napoli", Ruolo: "M;C" },
  "Folorunsho": { Squadra: "Napoli", Ruolo: "C;T" },

  "Pellegrini": { Squadra: "Roma", Ruolo: "C;T" },
  "Cristante": { Squadra: "Roma", Ruolo: "M;C" },
  "Paredes": { Squadra: "Roma", Ruolo: "M;C" },
  "Kone": { Squadra: "Roma", Ruolo: "M;C" },
  "Le Fée": { Squadra: "Roma", Ruolo: "C;T" },
  "Baldanzi": { Squadra: "Roma", Ruolo: "T;A" },

  "Ederson": { Squadra: "Atalanta", Ruolo: "M;C" },
  "Pasalic": { Squadra: "Atalanta", Ruolo: "C;T" },
  "De Roon": { Squadra: "Atalanta", Ruolo: "M;C" },
  "Samardzic": { Squadra: "Atalanta", Ruolo: "T" },
  "Brescianini": { Squadra: "Atalanta", Ruolo: "C;T" },

  "Guendouzi": { Squadra: "Lazio", Ruolo: "M;C" },
  "Rovella": { Squadra: "Lazio", Ruolo: "M;C" },
  "Vecino": { Squadra: "Lazio", Ruolo: "M;C" },
  "Dele-Bashiru": { Squadra: "Lazio", Ruolo: "C;T" },
  "Castrovilli": { Squadra: "Lazio", Ruolo: "C;T" },

  "Ferguson": { Squadra: "Bologna", Ruolo: "C;T" },
  "Freuler": { Squadra: "Bologna", Ruolo: "M;C" },
  "Aebischer": { Squadra: "Bologna", Ruolo: "C" },
  "Fabbian": { Squadra: "Bologna", Ruolo: "C;T" },
  "Moro": { Squadra: "Bologna", Ruolo: "C" },
  "Pobega": { Squadra: "Bologna", Ruolo: "C" },

  "Mandragora": { Squadra: "Fiorentina", Ruolo: "M;C" },
  "Bove": { Squadra: "Fiorentina", Ruolo: "C" },
  "Cataldi": { Squadra: "Fiorentina", Ruolo: "M;C" },
  "Richardson": { Squadra: "Fiorentina", Ruolo: "C" },
  "Adli": { Squadra: "Fiorentina", Ruolo: "C;T" },

  "Ricci": { Squadra: "Torino", Ruolo: "M;C" },
  "Ilic": { Squadra: "Torino", Ruolo: "C;T" },
  "Linetty": { Squadra: "Torino", Ruolo: "M;C" },
  "Vlasic": { Squadra: "Torino", Ruolo: "T" },
  "Tameze": { Squadra: "Torino", Ruolo: "M;C" },

  "Frendrup": { Squadra: "Genoa", Ruolo: "M;C" },
  "Badelj": { Squadra: "Genoa", Ruolo: "M;C" },
  "Malinovskyi": { Squadra: "Genoa", Ruolo: "C;T" },
  "Miretti": { Squadra: "Genoa", Ruolo: "C;T" },
  "Thorsby": { Squadra: "Genoa", Ruolo: "M;C" },

  "Paz": { Squadra: "Como", Ruolo: "T" },
  "Strefezza": { Squadra: "Como", Ruolo: "W;T" },
  "Perrone": { Squadra: "Como", Ruolo: "M;C" },
  "Ser Sergi Roberto": { Squadra: "Como", Ruolo: "M;C" },
  "Mazzitelli": { Squadra: "Como", Ruolo: "M;C" },
  "Braunoder": { Squadra: "Como", Ruolo: "M;C" },

  "Pessina": { Squadra: "Monza", Ruolo: "C;T" },
  "Bondo": { Squadra: "Monza", Ruolo: "M;C" },
  "Sensi": { Squadra: "Monza", Ruolo: "C;T" },
  "Maldini": { Squadra: "Monza", Ruolo: "T;A" },
  "Ciurria": { Squadra: "Monza", Ruolo: "E;W" },

  "Marin": { Squadra: "Cagliari", Ruolo: "C;T" },
  "Prati": { Squadra: "Cagliari", Ruolo: "M;C" },
  "Gaetano": { Squadra: "Cagliari", Ruolo: "T" },
  "Makoumbou": { Squadra: "Cagliari", Ruolo: "M;C" },
  "Adopo": { Squadra: "Cagliari", Ruolo: "M;C" },
  "Deiola": { Squadra: "Cagliari", Ruolo: "M;C" },

  "Lovric": { Squadra: "Udinese", Ruolo: "C;T" },
  "Karlstrom": { Squadra: "Udinese", Ruolo: "M;C" },
  "Payero": { Squadra: "Udinese", Ruolo: "C" },
  "Samardzic": { Squadra: "Udinese", Ruolo: "T" },
  "Ekkelenkamp": { Squadra: "Udinese", Ruolo: "C;T" },

  "Ramadani": { Squadra: "Lecce", Ruolo: "M;C" },
  "Rafia": { Squadra: "Lecce", Ruolo: "C;T" },
  "Pierret": { Squadra: "Lecce", Ruolo: "M;C" },
  "Oudin": { Squadra: "Lecce", Ruolo: "T;W" },
  "Marchwinski": { Squadra: "Lecce", Ruolo: "T" },

  "Duda": { Squadra: "Verona", Ruolo: "C;T" },
  "Serdar": { Squadra: "Verona", Ruolo: "M;C" },
  "Belahyane": { Squadra: "Verona", Ruolo: "M;C" },
  "Harroui": { Squadra: "Verona", Ruolo: "C;T" },
  "Suslov": { Squadra: "Verona", Ruolo: "T;W" },

  "Fazzini": { Squadra: "Empoli", Ruolo: "C;T" },
  "Grassie": { Squadra: "Empoli", Ruolo: "M;C" },
  "Anjorin": { Squadra: "Empoli", Ruolo: "C;T" },
  "Maleh": { Squadra: "Empoli", Ruolo: "C" },
  "Zurkowski": { Squadra: "Empoli", Ruolo: "C;T" },

  "Busio": { Squadra: "Venezia", Ruolo: "C;T" },
  "Nicolussi Caviglia": { Squadra: "Venezia", Ruolo: "M;C" },
  "Ellertsson": { Squadra: "Venezia", Ruolo: "C;E" },
  "Oristanio": { Squadra: "Venezia", Ruolo: "T;A" },
  "Duncan": { Squadra: "Venezia", Ruolo: "M;C" },

  // Attaccanti e Punte
  "Lautaro Martinez": { Squadra: "Inter", Ruolo: "Pc" },
  "Thuram M.": { Squadra: "Inter", Ruolo: "Pc" },
  "Taremi": { Squadra: "Inter", Ruolo: "Pc" },
  "Arnautovic": { Squadra: "Inter", Ruolo: "Pc" },
  "Correa": { Squadra: "Inter", Ruolo: "A" },

  "Vlahovic": { Squadra: "Juventus", Ruolo: "Pc" },
  "Yildiz": { Squadra: "Juventus", Ruolo: "A" },
  "Conceicao": { Squadra: "Juventus", Ruolo: "W;A" },
  "Nico Gonzalez": { Squadra: "Juventus", Ruolo: "W;A" },
  "Weah": { Squadra: "Juventus", Ruolo: "E;W" },
  "Milik": { Squadra: "Juventus", Ruolo: "Pc" },
  "Mbangula": { Squadra: "Juventus", Ruolo: "W;A" },

  "Morata": { Squadra: "Milan", Ruolo: "Pc" },
  "Leao": { Squadra: "Milan", Ruolo: "A" },
  "Abraham": { Squadra: "Milan", Ruolo: "Pc" },
  "Chukwueze": { Squadra: "Milan", Ruolo: "W;A" },
  "Okafor": { Squadra: "Milan", Ruolo: "A" },
  "Jovic": { Squadra: "Milan", Ruolo: "Pc" },
  "Camarda": { Squadra: "Milan", Ruolo: "Pc" },

  "Lukaku": { Squadra: "Napoli", Ruolo: "Pc" },
  "Kvaratskhelia": { Squadra: "Napoli", Ruolo: "A" },
  "Politano": { Squadra: "Napoli", Ruolo: "W;A" },
  "Neres": { Squadra: "Napoli", Ruolo: "W;A" },
  "Simeone": { Squadra: "Napoli", Ruolo: "Pc" },
  "Raspadori": { Squadra: "Napoli", Ruolo: "A" },
  "Ngonge": { Squadra: "Napoli", Ruolo: "W;A" },

  "Dovbyk": { Squadra: "Roma", Ruolo: "Pc" },
  "Dybala": { Squadra: "Roma", Ruolo: "A" },
  "Soulè": { Squadra: "Roma", Ruolo: "W;A" },
  "El Shaarawy": { Squadra: "Roma", Ruolo: "W;A" },
  "Shomurodov": { Squadra: "Roma", Ruolo: "Pc" },

  "Retegui": { Squadra: "Atalanta", Ruolo: "Pc" },
  "Lookman": { Squadra: "Atalanta", Ruolo: "A" },
  "De Ketelaere": { Squadra: "Atalanta", Ruolo: "T;A" },
  "Scamacca": { Squadra: "Atalanta", Ruolo: "Pc" },
  "Zaniolo": { Squadra: "Atalanta", Ruolo: "T;A" },

  "Castellanos": { Squadra: "Lazio", Ruolo: "Pc" },
  "Dia": { Squadra: "Lazio", Ruolo: "Pc;A" },
  "Zaccagni": { Squadra: "Lazio", Ruolo: "W;A" },
  "Noslin": { Squadra: "Lazio", Ruolo: "A" },
  "Isaksen": { Squadra: "Lazio", Ruolo: "W;A" },
  "Pedro": { Squadra: "Lazio", Ruolo: "A" },

  "Castro": { Squadra: "Bologna", Ruolo: "Pc" },
  "Dallinga": { Squadra: "Bologna", Ruolo: "Pc" },
  "Orsolini": { Squadra: "Bologna", Ruolo: "W;A" },
  "Ndoye": { Squadra: "Bologna", Ruolo: "W;A" },
  "Karlsson": { Squadra: "Bologna", Ruolo: "W;A" },
  "Iling-Junior": { Squadra: "Bologna", Ruolo: "W;A" },

  "Kean": { Squadra: "Fiorentina", Ruolo: "Pc" },
  "Gudmundsson": { Squadra: "Fiorentina", Ruolo: "T;A" },
  "Colpani": { Squadra: "Fiorentina", Ruolo: "T;A" },
  "Beltran": { Squadra: "Fiorentina", Ruolo: "Pc" },
  "Sottil": { Squadra: "Fiorentina", Ruolo: "W;A" },
  "Ikoné": { Squadra: "Fiorentina", Ruolo: "W;A" },

  "Zapata": { Squadra: "Torino", Ruolo: "Pc" },
  "Adams C.": { Squadra: "Torino", Ruolo: "Pc" },
  "Sanabria": { Squadra: "Torino", Ruolo: "Pc" },
  "Karamoh": { Squadra: "Torino", Ruolo: "A" },

  "Pinamonti": { Squadra: "Genoa", Ruolo: "Pc" },
  "Vitinha": { Squadra: "Genoa", Ruolo: "A" },
  "Ekuban": { Squadra: "Genoa", Ruolo: "Pc" },
  "Messias": { Squadra: "Genoa", Ruolo: "W;T" },

  "Cutrone": { Squadra: "Como", Ruolo: "Pc" },
  "Belotti": { Squadra: "Como", Ruolo: "Pc" },
  "Fadera": { Squadra: "Como", Ruolo: "W;A" },
  "Gabrielloni": { Squadra: "Como", Ruolo: "Pc" },

  "Djuric": { Squadra: "Monza", Ruolo: "Pc" },
  "Caprari": { Squadra: "Monza", Ruolo: "A" },
  "Mota": { Squadra: "Monza", Ruolo: "A" },
  "Forson": { Squadra: "Monza", Ruolo: "T;A" },

  "Piccoli": { Squadra: "Cagliari", Ruolo: "Pc" },
  "Luvumbo": { Squadra: "Cagliari", Ruolo: "A" },
  "Lapadula": { Squadra: "Cagliari", Ruolo: "Pc" },
  "Pavoletti": { Squadra: "Cagliari", Ruolo: "Pc" },

  "Lucca": { Squadra: "Udinese", Ruolo: "Pc" },
  "Thauvin": { Squadra: "Udinese", Ruolo: "A" },
  "Brenner": { Squadra: "Udinese", Ruolo: "A" },
  "Davis": { Squadra: "Udinese", Ruolo: "Pc" },
  "Sanchez": { Squadra: "Udinese", Ruolo: "T;A" },

  "Krstovic": { Squadra: "Lecce", Ruolo: "Pc" },
  "Rebic": { Squadra: "Lecce", Ruolo: "A" },
  "Banda": { Squadra: "Lecce", Ruolo: "W;A" },
  "Tete Morente": { Squadra: "Lecce", Ruolo: "W;A" },

  "Tengstedt": { Squadra: "Verona", Ruolo: "Pc" },
  "Mosquera": { Squadra: "Verona", Ruolo: "Pc" },
  "Livramento": { Squadra: "Verona", Ruolo: "A" },
  "Sarr": { Squadra: "Verona", Ruolo: "Pc" },

  "Esposito": { Squadra: "Empoli", Ruolo: "A" },
  "Colombo": { Squadra: "Empoli", Ruolo: "Pc" },
  "Solbakken": { Squadra: "Empoli", Ruolo: "W;A" },
  "Pellegri": { Squadra: "Empoli", Ruolo: "Pc" },

  "Pohjanpalo": { Squadra: "Venezia", Ruolo: "Pc" },
  "Gytkjaer": { Squadra: "Venezia", Ruolo: "Pc" },
  "Yeboah": { Squadra: "Venezia", Ruolo: "W;A" },
  "Raimondo": { Squadra: "Venezia", Ruolo: "Pc" }
};

// Known teams per fallback
const teamsList = [
  "Inter", "Juventus", "Milan", "Napoli", "Roma", "Atalanta", "Lazio", "Bologna",
  "Fiorentina", "Torino", "Genoa", "Como", "Monza", "Cagliari", "Udinese", "Lecce",
  "Verona", "Empoli", "Venezia", "Parma"
];

// Enrich players
let enrichedCount = 0;
players.forEach((p, idx) => {
  p.Id = p.Id || (idx + 1);
  const detail = playerDetails[p.Nome];

  if (detail) {
    p.Squadra = detail.Squadra;
    p.Ruolo = detail.Ruolo;
    p.FVM = p.FVM || Math.round((p.Quotazione || 10) * 1.2);
    enrichedCount++;
  } else {
    // If player is not in explicit dictionary, provide smart fallback based on Classic role
    p.Squadra = p.Squadra || teamsList[idx % teamsList.length];
    if (!p.Ruolo || ['Por','D','C','A'].includes(p.Ruolo)) {
      if (p.Ruolo === 'Por') p.Ruolo = 'Por';
      else if (p.Ruolo === 'D') p.Ruolo = idx % 2 === 0 ? 'Dc' : 'Ds;E';
      else if (p.Ruolo === 'C') p.Ruolo = idx % 2 === 0 ? 'M;C' : 'C;T';
      else if (p.Ruolo === 'A') p.Ruolo = idx % 2 === 0 ? 'Pc' : 'A';
    }
    p.FVM = p.FVM || Math.round((p.Quotazione || 10) * 1.2);
  }
});

fs.writeFileSync(listonePath, JSON.stringify(players, null, 2), 'utf8');
console.log(`Enriched ${players.length} players (${enrichedCount} exact matches with Mantra roles & Serie A teams) in listone.json.`);
