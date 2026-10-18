# Terminal et preuves — issue #29

Branche empilée sur `codex/studio-effective-capabilities`, dépend du daemon #156 et de son runner protocole 2.

- Cockpit > Terminal > Ouvrir le terminal du projet : xterm chargé à la demande, liste des shells autorisés, création explicite, saisie sérialisée, redimensionnement, reconnexion et fermeture explicite. Changer d’écran ne tue pas le shell ; le daemon impose l’expiration après inactivité.
- Sessions utilisateur et agent séparées côté daemon ; le navigateur ne consomme pas la file de sortie des agents.
- Revue et résumé de tâche : section Preuves fermée au départ, liste de métadonnées, téléchargement du PNG au clic, lecture des journaux au choix. Aucun chargement implicite de toutes les images.
- Les erreurs HTTP restent visibles. Une image ne signifie pas « scénario réussi ». Le code de sortie concerne le shell complet.

`npm run build` passe (TypeScript et Vite). xterm est dans un chunk séparé (~338 Ko brut). L’avertissement Vite du bundle principal >500 Ko persiste. Aucun test local, aucune vérification navigateur/daemon réelle réalisée pour cette tranche : clavier, mobile, rétablissement de connexion, preuves et permissions restent à valider avant clôture.
