const express = require('express');
const router = express.Router();

const User = require('../models/User');
const auth = require('../middleware/auth');

// Enregistrer ou retirer le consentement pour l'utilisateur connecté
router.post('/consentement', auth, async (req, res) => {
	try {
		const userId = req.user.id;
		const consent = !!req.body.consent;
		const update = { consentGiven: consent };
		if (consent) update.consentAt = new Date();
		else update.consentAt = null;

		const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password -__v');
		if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
		return res.json({ message: 'Consentement mis à jour', user });
	} catch (err) {
		console.error('Erreur consentement RGPD', err);
		return res.status(500).json({ message: 'Erreur serveur' });
	}
});

// Exporter les données utilisateur (soi-même ou admin)
router.get('/export/:id?', auth, auth.ensureSameUserOrAdmin, async (req, res) => {
	try {
		const id = req.params.id || req.user.id;
		const user = await User.findById(id).lean();
		if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
		delete user.password;
		delete user.__v;
		return res.json({ data: user });
	} catch (err) {
		console.error('Erreur export RGPD', err);
		return res.status(500).json({ message: 'Erreur serveur' });
	}
});

// Anonymiser / supprimer le compte (soi-même ou admin)
router.delete('/supprimer/:id?', auth, auth.ensureSameUserOrAdmin, async (req, res) => {
	try {
		const id = req.params.id || req.user.id;
		const user = await User.findById(id);
		if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

		await user.anonymize();
		return res.json({ message: 'Utilisateur anonymisé et supprimé (soft-delete)' });
	} catch (err) {
		console.error('Erreur suppression RGPD', err);
		return res.status(500).json({ message: 'Erreur serveur' });
	}
});

// Admin seulement : anonymiser un utilisateur par id
router.post('/anonymiser/:id', auth, auth.adminOnly, async (req, res) => {
	try {
		const id = req.params.id;
		if (!id) return res.status(400).json({ message: "Identifiant utilisateur manquant" });
		const user = await User.findById(id);
		if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

		await user.anonymize();
		return res.json({ message: 'Utilisateur anonymisé par un administrateur' });
	} catch (err) {
		console.error('Erreur anonymisation RGPD', err);
		return res.status(500).json({ message: 'Erreur serveur' });
	}
});

module.exports = router;
