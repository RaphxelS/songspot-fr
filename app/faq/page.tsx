import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — Songspot FR",
  description:
    "Questions fréquentes sur Songspot FR : comment jouer, d'où viennent les extraits audio, pourquoi commencer à 0,1 seconde, niveaux de difficulté, filtres par époque et attribution Spotify.",
};

export default function FAQPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Foire aux questions
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Tout ce qu&apos;il faut savoir pour profiter de Songspot FR — inspiré
          de songspot.net, adapté au catalogue français.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
        >
          ← Retour au jeu
        </Link>
      </header>

      <div className="space-y-10 text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
        <section id="comment-jouer" aria-labelledby="titre-comment-jouer">
          <h2
            id="titre-comment-jouer"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Comment jouer ?
          </h2>
          <p className="mt-3">
            Écoutez le premier extrait de <strong>0,1 seconde</strong> puis
            devinez le titre. Tapez au moins deux lettres : une liste de
            suggestions apparaît (titre — artiste, accent insensible, œ → oe,
            æ → ae). Sélectionnez une proposition avec les flèches et Entrée,
            ou validez votre saisie avec le bouton « Deviner ».
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              Bonne réponse : la partie est gagnée, la pochette, le titre,
              l&apos;artiste et l&apos;album s&apos;affichent, l&apos;extrait
              complet (15&nbsp;s) est disponible.
            </li>
            <li>
              Mauvaise réponse ou bouton « Passer » : vous passez au palier
              suivant — 0,5&nbsp;s, 2&nbsp;s, 8&nbsp;s puis 15&nbsp;s.
            </li>
            <li>
              Au bout de cinq essais sans succès, la réponse est révélée. Lancez
              un « Nouveau morceau » pour rejouer.
            </li>
          </ul>
          <p className="mt-3">
            Progression affichée en cinq pastilles : 0,1&nbsp;s / 0,5&nbsp;s / 2&nbsp;s / 8&nbsp;s / 15&nbsp;s.
            Vous pouvez désactiver certains paliers dans la progression ; au
            moins un palier reste toujours actif (0,1&nbsp;s par défaut). Le
            casque est recommandé.
          </p>
        </section>

        <section id="extraits" aria-labelledby="titre-extraits">
          <h2
            id="titre-extraits"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            D&apos;où viennent les extraits ?
          </h2>
          <p className="mt-3">
            Les extraits proviennent de l&apos;API Spotify : ce sont les
            aperçus de 30 secondes fournis par Spotify (« preview_url »). Nous
            n&apos;hébergeons aucune musique ; chaque clip est lu depuis 0
            seconde et coupé précisément à la durée du palier (0,1&nbsp;s à
            15&nbsp;s). En l&apos;absence d&apos;identifiants Spotify, le jeu
            s&apos;appuie sur le catalogue statique{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              data/catalog.fr.json
            </code>{" "}
            (95 titres français, pochettes via i.scdn.co, aperçus de test le
            cas échéant) — entièrement jouable hors ligne.
          </p>
          <p className="mt-3">
            Quand Spotify ne fournit pas d&apos;aperçu pour un titre (champ
            null), le morceau est exclu du tirage (politique « filter-only » du
            MVP). Aucune recherche Deezer n&apos;est effectuée tant que le réglage{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              ENABLE_DEEZER_FALLBACK
            </code>{" "}
            reste désactivé. Le script{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              scripts/validate-catalog.mjs
            </code>{" "}
            vérifie que chaque preview_url répond 200 et renvoie un type audio.
          </p>
        </section>

        <section id="pourquoi-0-1" aria-labelledby="titre-pourquoi-0-1">
          <h2
            id="titre-pourquoi-0-1"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Pourquoi commencer à 0,1&nbsp;seconde ?
          </h2>
          <p className="mt-3">
            0,1&nbsp;seconde suffit aux meilleures oreilles pour reconnaître une
            introduction culte (batterie, riff, voix). C&apos;est le défi
            signature de Songspot : un clin d&apos;œil ultra court, puis une
            aide progressive. Si vous ne reconnaissez pas en 0,1&nbsp;s, les
            paliers 0,5&nbsp;s et 2&nbsp;s lèvent déjà beaucoup de doutes ;
            8&nbsp;s et 15&nbsp;s conviennent à tous.
          </p>
          <p className="mt-3">
            Techniquement, l&apos;audio est découpé avec un minuteur principal
            (setTimeout) et un garde requestAnimationFrame / setInterval 20&nbsp;ms,
            sans autoplay : la lecture ne démarre qu&apos;après votre clic sur
            « Lecture ».
          </p>
        </section>

        <section id="difficultes" aria-labelledby="titre-difficultes">
          <h2
            id="titre-difficultes"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Niveaux de difficulté
          </h2>
          <p className="mt-3">
            Cinq niveaux basés sur la popularité Spotify (0–100) découpée en
            quintiles sur le catalogue courant : <strong>Facile</strong> (≥80e
            percentile, tubes ultra connus), <strong>Moyen</strong>,{" "}
            <strong>Difficile</strong>, <strong>Expert</strong> et{" "}
            <strong>Impossible</strong> (≤20e percentile, pépites peu diffusées).
            La Difficulté choisie filtre le réservoir du prochain tirage ; la
            partie en cours n&apos;est pas modifiée jusqu&apos;au « Nouveau
            morceau ».
          </p>
          <p className="mt-3">
            Si un niveau ne contient aucun titre après application des filtres
            (catalogue déséquilibré), une carte « Aucun morceau disponible »
            propose de repasser en « Facile » ou une autre difficulté. Les seuils sont
            recalculés à chaque changement de filtre par époque.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-semibold">Difficulté</th>
                  <th className="px-3 py-2 font-semibold">Percentile</th>
                  <th className="px-3 py-2 font-semibold">Exemple de popularité</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">Facile</td>
                  <td className="px-3 py-2">80–100 %</td>
                  <td className="px-3 py-2">≥ 82</td>
                </tr>
                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">Moyen</td>
                  <td className="px-3 py-2">60–80 %</td>
                  <td className="px-3 py-2">80–81</td>
                </tr>
                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">Difficile</td>
                  <td className="px-3 py-2">40–60 %</td>
                  <td className="px-3 py-2">77–79</td>
                </tr>
                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">Expert</td>
                  <td className="px-3 py-2">20–40 %</td>
                  <td className="px-3 py-2">75–76</td>
                </tr>
                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">Impossible</td>
                  <td className="px-3 py-2">0–20 %</td>
                  <td className="px-3 py-2">&lt; 75</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Seuils indicatifs sur le catalogue de 95 titres (Top 50 France &amp;
            Top Titres France) : p20=75, p40=77, p60=80, p80=82.
          </p>
        </section>

        <section id="epoques" aria-labelledby="titre-epoques">
          <h2
            id="titre-epoques"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Filtres par époque
          </h2>
          <p className="mt-3">
            Affinez le tirage par année de sortie : <strong>Toutes</strong>,{" "}
            <strong>Classique</strong> (avant 2000), <strong>2000s</strong>,{" "}
            <strong>2010s</strong> et <strong>2020s</strong>. Le filtre se
            combine avec la Difficulté. Changer d&apos;époque filtre aussi
            l&apos;historique local des morceaux déjà joués pour éviter les
            doublons incohérents.
          </p>
        </section>

        <section id="partage" aria-labelledby="titre-partage">
          <h2
            id="titre-partage"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Défier un ami
          </h2>
          <p className="mt-3">
            Après une victoire ou une défaite, « Défier un ami » copie une URL
            du type{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              ?track=&lt;id&gt;&amp;difficulty=Expert
            </code>
            . Votre ami ouvre le lien et joue exactement le même morceau dans
            la même Difficulté, avec le bandeau « Défi : devine ce morceau !
            (difficulté Expert) » et une annonce « Lien copié ! ». Si l&apos;identifiant
            est invalide, le jeu affiche « Défi introuvable, morceau aléatoire »
            et tire un titre au hasard.
          </p>
        </section>

        <section id="audio" aria-labelledby="titre-audio">
          <h2
            id="titre-audio"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Audio et compatibilité
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              Lecture uniquement sur interaction (pas d&apos;autoplay au
              chargement) pour respecter les politiques des navigateurs.
            </li>
            <li>
              Bouton « Depuis le début » remet le curseur à 0 sans relancer la
              lecture.
            </li>
            <li>
              Volume mémorisé dans le navigateur ; sur iOS le curseur est
              désactivé — utilisez les boutons matériels (« Volume via boutons
              matériels sur iOS »).
            </li>
            <li>
              En cas d&apos;erreur réseau (« Extrait indisponible, nouveau
              morceau »), utilisez « Nouveau morceau » pour repiocher.
            </li>
          </ul>
        </section>

        <section id="confidentialite" aria-labelledby="titre-confidentialite">
          <h2
            id="titre-confidentialite"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Confidentialité et stockage
          </h2>
          <p className="mt-3">
            Aucun compte, aucun suivi. Préférences (Difficulté, Époque, volume,
            paliers activés) et historique des morceaux déjà joués sont stockés
            uniquement dans le{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              localStorage
            </code>{" "}
            de votre navigateur (clés{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              songspot-fr:prefs
            </code>{" "}
            et{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              songspot-fr:playedIds
            </code>
            ). Effacer les données du site réinitialise le jeu.
          </p>
        </section>

        <section id="spotify" aria-labelledby="titre-spotify">
          <h2
            id="titre-spotify"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Attribution Spotify
          </h2>
          <p className="mt-3">
            Les extraits audio, pochettes et métadonnées proviennent de Spotify
            via la Spotify Web API (flux client-credentials côté serveur). Les
            pochettes sont diffusées depuis{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              i.scdn.co
            </code>{" "}
            et ne sont jamais mises en cache côté client au-delà du navigateur.
            Ce projet n&apos;est pas affilié à Spotify ; toutes les marques et
            contenus appartiennent à leurs propriétaires respectifs. Merci à
            Spotify de fournir les aperçus de 30&nbsp;secondes qui rendent ce
            jeu possible.
          </p>
          <p className="mt-3">
            Catalogue source : playlists « Top 50 France » et « Top Titres
            France » (identifiants par défaut{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              37i9dQZEVXbIP3c3fqVrJY
            </code>{" "}
            et{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              37i9dQZEVXb5AvMoO2SKHg
            </code>
            , surchargeables via{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              SPOTIFY_PLAYLIST_IDS
            </code>
            ). La route{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              /api/catalog
            </code>{" "}
            met en cache la réponse une heure (
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
            </code>
            ) et ne transmet jamais le jeton.
          </p>
        </section>

        <section id="inspire" aria-labelledby="titre-inspire">
          <h2
            id="titre-inspire"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            À propos
          </h2>
          <p className="mt-3">
            Songspot FR est un hommage francophone à{" "}
            <a
              href="https://songspot.net"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              songspot.net
            </a>{" "}
            — même principe, catalogue 100&nbsp;% français. Code ouvert, sans
            publicité, jouable sans identifiants grâce au catalogue statique.
            Pour toute suggestion, ouvrez une issue sur le dépôt du projet.
          </p>
        </section>
      </div>

      <footer className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} Songspot FR — Jeu musical gratuit —{" "}
          <Link href="/" className="underline underline-offset-4">
            Accueil
          </Link>{" "}
          ·{" "}
          <Link href="/faq" className="underline underline-offset-4">
            FAQ
          </Link>
        </p>
      </footer>
    </article>
  );
}
