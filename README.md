Run Turkey hatay 2023 construction script scraper

1.	Run ekap-hatay-2023.js
a.	Recupere les IKN et infos complementaire de la page demandée
b.	Necessite: 
c.	Output: ekap-hatay-2023.json
2.	Run ekap-full-scrapper.js
a.	Recupere toute les infos nécessaires par IKN
b.	Necessite: ekap-hatay-2023.json
c.	Output: ekap-results.json
3.	Run clean-ekap.js
a.	Format la data proprement (prix etc)
b.	Necessite: ekap-results.json
c.	Output: ekap-cleaned.json
4.	Run Filter-ekap.js
a.	Filtre les apples d’offres dont j’ai besoin ( post earthquake, pas annulé, procédure 21B)
b.	Necessite : ekap-cleaned.json
c.	Output: ekap-filtered.json
5.	Run export-csv.js
a.	Transforme de json a csv. Un csv avec tout dans le main folder et 4 autres pour Neo4j dans un folder neo4j_csv
b.	Necessite: ekap-filtered.json
c.	Output: ekap-full.scv (main)
 Administration (neo4j_csv)
Procedures (neo4j_csv)
Projects (neo4j_csv)
Relations (neo4j_c
