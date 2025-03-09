import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  onSnapshot,
  Timestamp,
  deleteDoc, // Ajoutez cette ligne
  query, // Ajoutez cette ligne
  where, // Ajoutez cette ligne
} from "firebase/firestore";
import axios from "axios";
import {
  FaPray,
  FaClock,
  FaSun,
  FaMoon,
  FaUser,
  FaCaretDown,
  FaFilePdf,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDMEKxLAsJffzSvO95Q7eog28P4OOPoi-Q",
  authDomain: "gestionrepas-658ad.firebaseapp.com",
  projectId: "gestionrepas-658ad",
  storageBucket: "gestionrepas-658ad.appspot.com",
  messagingSenderId: "250822111463",
  appId: "1:250822111463:web:b7a80e011256728473b242",
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function GestionRepas() {
  // États
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [repas, setRepas] = useState("");
  const [reservations, setReservations] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [activeDate, setActiveDate] = useState(new Date());
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFormActive, setIsFormActive] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const reservationsPerPage = 5; // 5 réservations par page

  // Fonction pour vérifier si la date est un mercredi ou un dimanche en mars 2025
  const isActiveDay = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    // Le formulaire est ouvert tous les jours de mars 2025 sauf mercredi (3) et dimanche (0)
    if (year === 2025 && month === 3) {
      return dayOfWeek !== 3 && dayOfWeek !== 0; // true si ce n'est pas mercredi ou dimanche
    }
    return false; // Hors de mars 2025
  };
  // Charger la date active et les heures de prières au démarrage
  useEffect(() => {
    const docRef = doc(db, "active_dates", "current");

    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const firestoreDate = docSnap.data().date;
        const newDate = firestoreDate.toDate();

        if (isNaN(newDate.getTime())) {
          console.error("Date invalide :", firestoreDate);
          setError("La date active est invalide.");
        } else {
          // Vérifier si la date active a changé
          if (activeDate.toDateString() !== newDate.toDateString()) {
            // Supprimer les réservations de l'ancienne date
            await deleteReservationsForDate(activeDate);

            // Mettre à jour la date active et vider la liste des réservations
            setActiveDate(newDate);
            setIsFormActive(isActiveDay(newDate));
            setReservations([]); // Vider la liste des réservations
          }
        }
      } else {
        setError("Aucune date active trouvée.");
      }
    });

    fetchPrayerTimes();

    return () => unsubscribe();
  }, [activeDate]); // Déclencher l'effet lorsque activeDate change
  // Récupérer les heures de prières via l'API Aladhan
  const fetchPrayerTimes = async () => {
    setLoading(true);
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const city = "Paris";

    try {
      const response = await axios.get(
        "https://api.aladhan.com/v1/calendarByCity",
        {
          params: {
            city,
            country: "France",
            method: 2,
            month,
            year,
          },
        }
      );

      if (!response.data || !response.data.data) {
        setError("Aucune donnée trouvée dans la réponse de l'API.");
        return;
      }

      const todayPrayers = response.data.data.find((d) => {
        const prayerDate = new Date(d.date.readable);
        return (
          prayerDate.getFullYear() === year &&
          prayerDate.getMonth() + 1 === month &&
          prayerDate.getDate() === day
        );
      });

      if (todayPrayers && todayPrayers.timings) {
        setPrayerTimes(todayPrayers.timings);
      } else {
        setError("Aucune donnée de prière disponible pour aujourd'hui.");
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des heures de prières:",
        error
      );
      setError("Impossible de récupérer les heures de prières.");
    } finally {
      setLoading(false);
    }
  };

  // Gérer la connexion admin
  const handleAdminLogin = () => {
    if (password === "R@madaN2025") {
      setAdmin(true);
      fetchReservations();
      setPassword("");
    } else {
      alert("Mot de passe incorrect!");
    }
  };

  // Gérer la déconnexion admin
  const handleAdminLogout = () => {
    setAdmin(false);
    setShowAdminMenu(false);
  };

  // Récupérer les réservations depuis Firestore
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "reservations"));
      setReservations(
        querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations:", error);
      setError("Impossible de récupérer les réservations.");
    } finally {
      setLoading(false);
    }
  };
  // Fonction pour supprimer les réservations de la base de données
  const deleteReservationsForDate = async (date) => {
    try {
      const reservationsRef = collection(db, "reservations");
      const q = query(
        reservationsRef,
        where("date", "==", Timestamp.fromDate(date))
      );
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });

      console.log(
        "Réservations supprimées pour la date :",
        date.toLocaleDateString()
      );
    } catch (error) {
      console.error("Erreur lors de la suppression des réservations:", error);
      setError("Impossible de supprimer les réservations.");
    }
  };

  // Enregistrer une nouvelle réservation
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (nom && prenom && repas && activeDate) {
      setLoading(true);
      try {
        await addDoc(collection(db, "reservations"), {
          nom,
          prenom,
          repas: Number(repas),
          date: Timestamp.fromDate(activeDate),
        });

        // Afficher un message toast de succès
        toast.success("Réservation enregistrée avec succès!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        // Réinitialiser les champs du formulaire
        setNom("");
        setPrenom("");
        setRepas("");

        // Mettre à jour la liste des réservations
        fetchReservations();
      } catch (error) {
        console.error(
          "Erreur lors de l'enregistrement de la réservation:",
          error
        );
        setError("Impossible d'enregistrer la réservation.");

        // Afficher un message toast d'erreur
        toast.error("Erreur lors de l'enregistrement de la réservation.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Afficher un message toast si les champs ne sont pas remplis
      toast.warning("Veuillez remplir tous les champs!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  // Pagination
  const indexOfLastReservation = currentPage * reservationsPerPage;
  const indexOfFirstReservation = indexOfLastReservation - reservationsPerPage;
  const currentReservations = reservations.slice(
    indexOfFirstReservation,
    indexOfLastReservation
  );

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Exporter en PDF
  const exportToPDF = () => {
    const doc = new jsPDF();

    // Définir les en-têtes du tableau
    const headers = [["Nom", "Prénom", "Repas", "Date"]];

    // Préparer les données du tableau
    const data = reservations.map((res) => [
      res.nom,
      res.prenom,
      res.repas,
      new Date(res.date.toDate()).toLocaleDateString(),
    ]);

    // Générer le tableau dans le PDF
    autoTable(doc, {
      head: headers,
      body: data,
    });

    // Télécharger le PDF
    doc.save("reservations.pdf");
  };

  // Fonction pour déterminer le prochain jour de réservation
  const getNextReservationDate = (date) => {
    const dayOfWeek = date.getDay(); // Jour de la semaine actuel (0 = dimanche, 3 = mercredi)
    const daysUntilNextWednesday = (3 - dayOfWeek + 7) % 7; // Jours restants jusqu'au prochain mercredi
    const daysUntilNextSunday = (0 - dayOfWeek + 7) % 7; // Jours restants jusqu'au prochain dimanche

    // Si aujourd'hui est entre dimanche (0) et mercredi (3), réserver pour mercredi
    if (dayOfWeek >= 0 && dayOfWeek < 3) {
      const nextWednesday = new Date(date);
      nextWednesday.setDate(date.getDate() + daysUntilNextWednesday);
      return `Réservez pour le mercredi ${nextWednesday.toLocaleDateString()}`;
    }
    // Sinon, réserver pour dimanche
    const nextSunday = new Date(date);
    nextSunday.setDate(date.getDate() + daysUntilNextSunday);
    return `Réservez pour le dimanche ${nextSunday.toLocaleDateString()}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Vidéo de fond globale */}
      <video
        autoPlay
        loop
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/ramadan-video.mp4" type="video/mp4" />
        Votre navigateur ne supporte pas la vidéo.
      </video>

      {/* Barre de navigation en haut */}
      <div className="absolute top-0 left-0 right-0 bg-white bg-opacity-90 p-4 flex flex-col md:flex-row justify-between items-center z-20">
        <h1 className="text-xl md:text-2xl font-bold text-blue-700 mb-2 md:mb-0">
          AMB: Réserver votre Repas
        </h1>

        {/* Connexion Admin */}
        {!admin ? (
          <div className="flex items-center space-x-2">
            <input
              type="password"
              placeholder="admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-32 md:w-auto"
            />
            <button
              onClick={handleAdminLogin}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
            >
              Connexion
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowAdminMenu(!showAdminMenu)}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              <FaUser />
              <span>Admin</span>
              <FaCaretDown />
            </button>

            {/* Menu déroulant admin */}
            {showAdminMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg">
                <button
                  onClick={handleAdminLogout}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenu principal avec vidéo de fond */}
      <div className="relative bg-white bg-opacity-90 p-4 md:p-8 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row gap-4 md:gap-8 z-10 mt-16 md:mt-20 overflow-hidden">
        {/* Vidéo de fond pour le contenu principal */}

        {/* Section des heures de prière */}
        <div className="w-full md:w-1/2 bg-blue-50 bg-opacity-90 p-4 md:p-6 rounded-xl shadow-sm relative z-10">
          <br />
          <br />
          <h2 className="text-lg font-semibold text-blue-700 mb-4 flex items-center justify-center">
            <FaPray className="mr-2" /> Heures de Prières
          </h2>
          {loading ? (
            <div className="text-center text-blue-700">
              Chargement des heures de prières...
            </div>
          ) : prayerTimes ? (
            <ul className="space-y-2">
              {Object.entries(prayerTimes).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">
                    {key === "Fajr" && <FaSun className="inline mr-2" />}
                    {key === "Dhuhr" && <FaClock className="inline mr-2" />}
                    {key === "Asr" && <FaClock className="inline mr-2" />}
                    {key === "Maghrib" && <FaSun className="inline mr-2" />}
                    {key === "Isha" && <FaMoon className="inline mr-2" />}
                    {key}
                  </span>
                  <span className="text-blue-700">{value.split(" ")[0]}</span>
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="text-center text-red-600">{error}</div>
          ) : null}
        </div>

        {/* Section du formulaire */}

        <div className="w-full md:w-1/2 relative z-10">
          {/* Afficher la date active */}
          {activeDate && (
            <div className="mb-4 md:mb-6 text-center">
              <p className="text-lg font-semibold text-blue-700">
                <br />
                Nous somme le :
              </p>
              <p className="text-xl font-bold text-blue-900">
                {activeDate.toLocaleDateString()}
              </p>
              {/* Message dynamique pour la réservation */}
              <p className="mt-4 text-xl text-green-600 font-bold tracking-wide text-center uppercase">
                📅{getNextReservationDate(activeDate)}
              </p>
            </div>
          )}

          {/* Formulaire de réservation pour les clients */}
          {!admin && isFormActive ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full border p-3 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="text"
                placeholder="Prénom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="w-full border p-3 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="number"
                placeholder="Nombre de repas"
                value={repas}
                onChange={(e) => setRepas(e.target.value)}
                className="w-full border p-3 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-3 rounded-xl text-lg font-bold hover:bg-blue-600 transition"
              >
                Réserver
              </button>
            </form>
          ) : !admin ? (
            <div className="mb-4 md:mb-6 text-center text-red-600 text-xl font-bold bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
              <span role="img" aria-label="Attention">
                ⚠️
              </span>{" "}
              OUPS! Réservez tous les jours{" "}
              <span className="text-blue-600">
                sauf les jours de livraison:
              </span>{" "}
              <span className="text-red-700 underline">Mercredi</span> et{" "}
              <span className="text-red-700 underline">Dimanche</span>{" "}
              <span role="img" aria-label="Repas">
                🍽️
              </span>
            </div>
          ) : null}

          {/* Espace Admin (liste des réservations) */}
          {admin && (
            <div className="mt-4 md:mt-8">
              <h2 className="text-xl font-bold text-center text-blue-700 mb-4">
                Liste des réservations
              </h2>
              <button
                onClick={exportToPDF}
                className="bg-green-500 text-white px-4 py-2 rounded-lg mb-4 flex items-center space-x-2"
              >
                <FaFilePdf />
                <span>Exporter en PDF</span>
              </button>
              <ul className="space-y-2">
                {currentReservations.map((res) => (
                  <li
                    key={res.id}
                    className="bg-blue-50 p-3 rounded-xl shadow-sm"
                  >
                    {res.nom} {res.prenom} - {res.repas} repas (le{" "}
                    {new Date(res.date.toDate()).toLocaleDateString()})
                  </li>
                ))}
              </ul>
              {/* Pagination */}

              <div className="flex justify-center mt-4">
                {Array.from(
                  {
                    length: Math.ceil(
                      reservations.length / reservationsPerPage
                    ),
                  },
                  (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => paginate(i + 1)}
                      className={`mx-1 px-3 py-1 rounded-lg ${
                        currentPage === i + 1
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200"
                      }`}
                    >
                      {i + 1}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ToastContainer pour afficher les notifications */}
      <ToastContainer />
    </div>
  );
}
