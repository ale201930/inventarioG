import { db, auth, isFirebaseConfigured } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  orderBy 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";

export { isFirebaseConfigured };

// --- LOCAL STORAGE HELPERS ---
const getLocalData = (key) => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLocalData = (key, data) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
};

// --- AUTHENTICATION SERVICE ---
export const loginUser = async (email, password) => {
  if (isFirebaseConfigured && auth) {
    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      const cleanUsername = cleanEmail.replace(/\s+/g, "");
      
      // Parse dynamic username-to-email mapping from env
      let userMap = {};
      try {
        userMap = JSON.parse(process.env.NEXT_PUBLIC_USER_MAP || "{}");
      } catch (e) {
        console.error("Error parsing NEXT_PUBLIC_USER_MAP:", e);
      }

      // Check if username matches any mapping
      if (userMap[cleanUsername]) {
        cleanEmail = userMap[cleanUsername];
      } else {
        const suffix = process.env.NEXT_PUBLIC_AUTH_SUFFIX || "@inventario.com";
        cleanEmail = `${cleanUsername}${suffix}`;
      }
      console.log(`[Login] Usuario convertido a: "${cleanEmail}"`);
    } else {
      console.log(`[Login] Email completo ingresado: "${cleanEmail}"`);
    }
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return userCredential.user;
  } else {
    // Local fallback: Accept admin/admin or admin@admin.com/admin
    const cleanEmail = email.trim().toLowerCase();
    if ((cleanEmail === "admin" || cleanEmail === "admin@admin.com") && password === "admin") {
      const user = { email: "admin@admin.com", uid: "local-admin" };
      localStorage.setItem("auth_session", JSON.stringify(user));
      return user;
    } else {
      throw new Error("Credenciales incorrectas (Fallback Local: admin / admin)");
    }
  }
};

export const resetPassword = async (emailOrUsername) => {
  if (isFirebaseConfigured && auth) {
    let cleanEmail = emailOrUsername.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      const cleanUsername = cleanEmail.replace(/\s+/g, "");
      
      let userMap = {};
      try {
        userMap = JSON.parse(process.env.NEXT_PUBLIC_USER_MAP || "{}");
      } catch (e) {
        console.error("Error parsing NEXT_PUBLIC_USER_MAP:", e);
      }

      if (userMap[cleanUsername]) {
        cleanEmail = userMap[cleanUsername];
        console.log(`[ResetPassword] Usuario mapeado en USER_MAP a: "${cleanEmail}"`);
      } else {
        const suffix = process.env.NEXT_PUBLIC_AUTH_SUFFIX || "@inventario.com";
        cleanEmail = `${cleanUsername}${suffix}`;
        console.log(`[ResetPassword] Usuario sin mapeo, usando sufijo: "${cleanEmail}"`);
      }
    } else {
      console.log(`[ResetPassword] Email completo ingresado: "${cleanEmail}"`);
    }
    console.log(`[ResetPassword] Intentando enviar correo a: "${cleanEmail}"`);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      console.log("[ResetPassword] Firebase procesó el envío del correo con éxito.");
    } catch (firebaseErr) {
      console.error("[ResetPassword] Error de Firebase:", firebaseErr.code, firebaseErr.message);
      if (firebaseErr.code === "auth/user-not-found") {
        throw new Error(`No existe ninguna cuenta registrada con el correo: ${cleanEmail}. Verifica que el usuario esté registrado en Firebase.`);
      } else if (firebaseErr.code === "auth/invalid-email") {
        throw new Error(`El correo ingresado (${cleanEmail}) no tiene un formato válido.`);
      } else if (firebaseErr.code === "auth/too-many-requests") {
        throw new Error("Demasiadas solicitudes. Por favor espera un momento antes de intentarlo nuevamente.");
      } else {
        throw new Error(`Error al enviar el correo: ${firebaseErr.message}`);
      }
    }
  } else {
    throw new Error("El restablecimiento de contraseña no está disponible en modo local.");
  }
};

export const logoutUser = async () => {
  if (isFirebaseConfigured && auth) {
    await fbSignOut(auth);
  } else {
    localStorage.removeItem("auth_session");
  }
};

export const subscribeToAuth = (callback) => {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Local fallback subscription
    if (typeof window === "undefined") {
      callback(null);
      return () => {};
    }
    const checkSession = () => {
      const session = localStorage.getItem("auth_session");
      callback(session ? JSON.parse(session) : null);
    };
    checkSession();
    window.addEventListener("storage", checkSession);
    return () => {
      window.removeEventListener("storage", checkSession);
    };
  }
};

// --- ENTRADAS (INPUTS) SERVICE ---
export const getEntradas = async () => {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "entradas"), orderBy("fecha", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Double check client side sorting to be safe
      return list.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    } catch (e) {
      console.error("Firebase read error, falling back to local: ", e);
    }
  }
  const localList = getLocalData("entradas");
  return localList.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
};

export const addEntrada = async (entrada) => {
  const newEntrada = {
    ...entrada,
    saldoAdeudado: parseFloat(entrada.totalFactura) || 0,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    const docRef = await addDoc(collection(db, "entradas"), newEntrada);
    return { id: docRef.id, ...newEntrada };
  } else {
    const list = getLocalData("entradas");
    newEntrada.id = "ent-" + Math.random().toString(36).substr(2, 9);
    list.push(newEntrada);
    setLocalData("entradas", list);
    return newEntrada;
  }
};

export const updateEntradaTotal = async (id, newTotal) => {
  const cleanTotal = parseFloat(newTotal) || 0;
  if (isFirebaseConfigured && db) {
    // We need to fetch the entrada, calculate paid amount, then update total and remaining balance
    const entradasList = await getEntradas();
    const entrada = entradasList.find(e => e.id === id);
    if (!entrada) throw new Error("Factura no encontrada");
    const abonosList = await getAbonosEntradas();
    const relatedAbonos = abonosList.filter(a => a.entradaId === id);
    const paidAmount = relatedAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
    const newSaldo = Math.max(0, cleanTotal - paidAmount);

    const docRef = doc(db, "entradas", id);
    await updateDoc(docRef, {
      totalFactura: cleanTotal,
      saldoAdeudado: newSaldo
    });
    return { id, totalFactura: cleanTotal, saldoAdeudado: newSaldo };
  } else {
    const list = getLocalData("entradas");
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) throw new Error("Factura no encontrada");
    const abonosList = getLocalData("abonos_entradas");
    const relatedAbonos = abonosList.filter(a => a.entradaId === id);
    const paidAmount = relatedAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
    const newSaldo = Math.max(0, cleanTotal - paidAmount);

    list[idx].totalFactura = cleanTotal;
    list[idx].saldoAdeudado = newSaldo;
    setLocalData("entradas", list);
    return list[idx];
  }
};

// --- ABONOS ENTRADAS SERVICE ---
export const getAbonosEntradas = async () => {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "abonos_entradas"), orderBy("fecha", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error(e);
    }
  }
  return getLocalData("abonos_entradas").sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
};

export const addAbonoEntrada = async (abono) => {
  const newAbono = {
    ...abono,
    montoUSD: parseFloat(abono.montoUSD) || 0,
    montoVES: parseFloat(abono.montoVES) || 0,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    // 1. Add abono doc
    const docRef = await addDoc(collection(db, "abonos_entradas"), newAbono);
    // 2. Fetch the corresponding entrada and subtract debt
    const entradasList = await getEntradas();
    const entrada = entradasList.find(e => e.id === abono.entradaId);
    if (entrada) {
      const newSaldo = Math.max(0, (parseFloat(entrada.saldoAdeudado) || 0) - newAbono.montoUSD);
      const entradaDoc = doc(db, "entradas", abono.entradaId);
      await updateDoc(entradaDoc, { saldoAdeudado: newSaldo });
    }
    return { id: docRef.id, ...newAbono };
  } else {
    const abonos = getLocalData("abonos_entradas");
    newAbono.id = "abent-" + Math.random().toString(36).substr(2, 9);
    abonos.push(newAbono);
    setLocalData("abonos_entradas", abonos);

    // Update the entrada
    const entradas = getLocalData("entradas");
    const idx = entradas.findIndex(e => e.id === abono.entradaId);
    if (idx !== -1) {
      entradas[idx].saldoAdeudado = Math.max(0, (parseFloat(entradas[idx].saldoAdeudado) || 0) - newAbono.montoUSD);
      setLocalData("entradas", entradas);
    }
    return newAbono;
  }
};

export const deleteAbonoEntrada = async (abonoId, entradaId, montoUSD) => {
  const amount = parseFloat(montoUSD) || 0;

  if (isFirebaseConfigured && db) {
    // 1. Delete abono doc
    const abonoRef = doc(db, "abonos_entradas", abonoId);
    await deleteDoc(abonoRef);

    // 2. Recalculate saldo from scratch
    const entradasList = await getEntradas();
    const entrada = entradasList.find(e => e.id === entradaId);
    if (entrada) {
      const remainingAbonos = (await getAbonosEntradas()).filter(a => a.entradaId === entradaId);
      const totalPaid = remainingAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
      const newSaldo = Math.max(0, (parseFloat(entrada.totalFactura) || 0) - totalPaid);
      const entradaDoc = doc(db, "entradas", entradaId);
      await updateDoc(entradaDoc, { saldoAdeudado: newSaldo });
    }
  } else {
    const abonos = getLocalData("abonos_entradas");
    const filtered = abonos.filter(a => a.id !== abonoId);
    setLocalData("abonos_entradas", filtered);

    const entradas = getLocalData("entradas");
    const idx = entradas.findIndex(e => e.id === entradaId);
    if (idx !== -1) {
      const relatedAbonos = filtered.filter(a => a.entradaId === entradaId);
      const totalPaid = relatedAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
      entradas[idx].saldoAdeudado = Math.max(0, (parseFloat(entradas[idx].totalFactura) || 0) - totalPaid);
      setLocalData("entradas", entradas);
    }
  }
};

export const updateAbonoEntrada = async (abonoId, entradaId, updatedFields) => {
  if (isFirebaseConfigured && db) {
    const abonoRef = doc(db, "abonos_entradas", abonoId);
    await updateDoc(abonoRef, {
      fecha: updatedFields.fecha,
      referencia: updatedFields.referencia,
      montoVES: parseFloat(updatedFields.montoVES) || 0,
      montoUSD: parseFloat(updatedFields.montoUSD) || 0,
    });

    // Recalculate saldo
    const entradasList = await getEntradas();
    const entrada = entradasList.find(e => e.id === entradaId);
    if (entrada) {
      const allAbonos = await getAbonosEntradas();
      const relatedAbonos = allAbonos.filter(a => a.entradaId === entradaId);
      const totalPaid = relatedAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
      const newSaldo = Math.max(0, (parseFloat(entrada.totalFactura) || 0) - totalPaid);
      const entradaDoc = doc(db, "entradas", entradaId);
      await updateDoc(entradaDoc, { saldoAdeudado: newSaldo });
    }
  } else {
    const abonos = getLocalData("abonos_entradas");
    const idx = abonos.findIndex(a => a.id === abonoId);
    if (idx !== -1) {
      abonos[idx] = {
        ...abonos[idx],
        fecha: updatedFields.fecha,
        referencia: updatedFields.referencia,
        montoVES: parseFloat(updatedFields.montoVES) || 0,
        montoUSD: parseFloat(updatedFields.montoUSD) || 0,
      };
      setLocalData("abonos_entradas", abonos);

      const entradas = getLocalData("entradas");
      const eIdx = entradas.findIndex(e => e.id === entradaId);
      if (eIdx !== -1) {
        const relatedAbonos = abonos.filter(a => a.entradaId === entradaId);
        const totalPaid = relatedAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
        entradas[eIdx].saldoAdeudado = Math.max(0, (parseFloat(entradas[eIdx].totalFactura) || 0) - totalPaid);
        setLocalData("entradas", entradas);
      }
    }
  }
};

export const updateAbonoSalida = async (abonoId, clienteName, updatedFields) => {
  if (isFirebaseConfigured && db) {
    const abonoRef = doc(db, "abonos_salidas", abonoId);
    await updateDoc(abonoRef, {
      fecha: updatedFields.fecha,
      referencia: updatedFields.referencia,
      montoVES: parseFloat(updatedFields.montoVES) || 0,
      montoUSD: parseFloat(updatedFields.montoUSD) || 0,
    });

    // Recalculate client balances from scratch
    const salidasList = await getSalidas();
    const clientSalidas = salidasList.filter(s => s.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());
    const allAbonos = await getAbonosSalidas();
    const clientAbonos = allAbonos.filter(a => a.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());

    const sortedSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const tempBalances = {};
    sortedSalidas.forEach(s => { tempBalances[s.id] = parseFloat(s.totalFactura) || 0; });

    let totalAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
    for (let s of sortedSalidas) {
      const debt = tempBalances[s.id];
      if (totalAbonado >= debt) { tempBalances[s.id] = 0; totalAbonado -= debt; }
      else { tempBalances[s.id] = Math.max(0, debt - totalAbonado); totalAbonado = 0; }
    }
    for (let s of sortedSalidas) {
      const sRef = doc(db, "salidas", s.id);
      await updateDoc(sRef, { saldoAdeudado: tempBalances[s.id] });
    }
  } else {
    const abonos = getLocalData("abonos_salidas");
    const idx = abonos.findIndex(a => a.id === abonoId);
    if (idx !== -1) {
      abonos[idx] = {
        ...abonos[idx],
        fecha: updatedFields.fecha,
        referencia: updatedFields.referencia,
        montoVES: parseFloat(updatedFields.montoVES) || 0,
        montoUSD: parseFloat(updatedFields.montoUSD) || 0,
      };
      setLocalData("abonos_salidas", abonos);

      const salidas = getLocalData("salidas");
      const clientSalidas = salidas.filter(s => s.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());
      const clientAbonos = abonos.filter(a => a.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());
      const sortedClientSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      const tempBalances = {};
      sortedClientSalidas.forEach(s => { tempBalances[s.id] = parseFloat(s.totalFactura) || 0; });
      let totalClientAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);
      for (let s of sortedClientSalidas) {
        const debt = tempBalances[s.id];
        if (totalClientAbonado >= debt) { tempBalances[s.id] = 0; totalClientAbonado -= debt; }
        else { tempBalances[s.id] = Math.max(0, debt - totalClientAbonado); totalClientAbonado = 0; }
      }
      salidas.forEach(s => {
        if (s.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim()) {
          s.saldoAdeudado = tempBalances[s.id];
        }
      });
      setLocalData("salidas", salidas);
    }
  }
};

// --- SALIDAS (OUTPUTS/DESPACHOS) SERVICE ---
export const getSalidas = async () => {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "salidas"), orderBy("fecha", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return list.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    } catch (e) {
      console.error(e);
    }
  }
  const localList = getLocalData("salidas");
  return localList.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
};

export const addSalida = async (salida) => {
  const newSalida = {
    ...salida,
    saldoAdeudado: parseFloat(salida.totalFactura) || 0,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    const docRef = await addDoc(collection(db, "salidas"), newSalida);
    return { id: docRef.id, ...newSalida };
  } else {
    const list = getLocalData("salidas");
    newSalida.id = "sal-" + Math.random().toString(36).substr(2, 9);
    list.push(newSalida);
    setLocalData("salidas", list);
    return newSalida;
  }
};

export const updateSalidaTotal = async (id, newTotal) => {
  const cleanTotal = parseFloat(newTotal) || 0;
  if (isFirebaseConfigured && db) {
    // 1. Fetch outputs and this specific one
    const salidasList = await getSalidas();
    const salida = salidasList.find(s => s.id === id);
    if (!salida) throw new Error("Despacho no encontrado");

    // Recalculate how much of this output has been paid.
    // Client abonos are applied general-style, but we track the remaining debt per invoice.
    // So we need to re-verify if client payments discounted this invoice.
    // Let's do it by fetching client payments and running client payments algorithm over all client's invoices.
    // We will do a full recalculation below to keep it correct, or simple subtraction.
    // For simplicity and correct state, we recalculate the client's debts.
    // Let's fetch all outputs of this client and all abonos of this client, and re-apply them.
    const clientName = salida.clienteName;
    const clientSalidas = salidasList.filter(s => s.clienteName === clientName);
    const abonosList = await getAbonosSalidas();
    const clientAbonos = abonosList.filter(a => a.clienteName === clientName);

    // Apply client abonos to their invoices
    // Sort client outputs by date ascending to pay oldest first
    const sortedClientSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    // Initialize temporary balances
    const tempBalances = {};
    sortedClientSalidas.forEach(s => {
      // If it's the target invoice, use newTotal, else use original totalFactura
      tempBalances[s.id] = s.id === id ? cleanTotal : (parseFloat(s.totalFactura) || 0);
    });

    let totalClientAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);

    for (let s of sortedClientSalidas) {
      const debt = tempBalances[s.id];
      if (totalClientAbonado >= debt) {
        tempBalances[s.id] = 0;
        totalClientAbonado -= debt;
      } else {
        tempBalances[s.id] = Math.max(0, debt - totalClientAbonado);
        totalClientAbonado = 0;
      }
    }

    // Now update target invoice
    const docRef = doc(db, "salidas", id);
    await updateDoc(docRef, {
      totalFactura: cleanTotal,
      saldoAdeudado: tempBalances[id]
    });

    // Also update any other invoice that might have shifted debts due to total change
    for (let s of sortedClientSalidas) {
      if (s.id !== id) {
        const otherRef = doc(db, "salidas", s.id);
        await updateDoc(otherRef, { saldoAdeudado: tempBalances[s.id] });
      }
    }

    return { id, totalFactura: cleanTotal, saldoAdeudado: tempBalances[id] };
  } else {
    const list = getLocalData("salidas");
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Despacho no encontrado");

    const clientName = list[idx].clienteName;
    const clientSalidas = list.filter(s => s.clienteName === clientName);
    const abonosList = getLocalData("abonos_salidas");
    const clientAbonos = abonosList.filter(a => a.clienteName === clientName);

    const sortedClientSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const tempBalances = {};
    sortedClientSalidas.forEach(s => {
      tempBalances[s.id] = s.id === id ? cleanTotal : (parseFloat(s.totalFactura) || 0);
    });

    let totalClientAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);

    for (let s of sortedClientSalidas) {
      const debt = tempBalances[s.id];
      if (totalClientAbonado >= debt) {
        tempBalances[s.id] = 0;
        totalClientAbonado -= debt;
      } else {
        tempBalances[s.id] = Math.max(0, debt - totalClientAbonado);
        totalClientAbonado = 0;
      }
    }

    // Update inside main list
    list.forEach(s => {
      if (s.clienteName === clientName) {
        s.saldoAdeudado = tempBalances[s.id];
        if (s.id === id) {
          s.totalFactura = cleanTotal;
        }
      }
    });

    setLocalData("salidas", list);
    return list[idx];
  }
};

// --- ABONOS SALIDAS (CLIENT PAYMENTS) SERVICE ---
export const getAbonosSalidas = async () => {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "abonos_salidas"), orderBy("fecha", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error(e);
    }
  }
  return getLocalData("abonos_salidas").sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
};

export const addAbonoSalida = async (abono) => {
  const newAbono = {
    ...abono,
    montoUSD: parseFloat(abono.montoUSD) || 0,
    montoVES: parseFloat(abono.montoVES) || 0,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    // 1. Store abono
    const docRef = await addDoc(collection(db, "abonos_salidas"), newAbono);

    // 2. Recalculate client balances (oldest unpaid invoices first)
    const salidasList = await getSalidas();
    const clientSalidas = salidasList.filter(s => s.clienteName.toLowerCase().trim() === abono.clienteName.toLowerCase().trim());
    
    // Sort client invoices by date ascending
    const sortedSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    let pendingPayment = newAbono.montoUSD;

    for (let salida of sortedSalidas) {
      if (pendingPayment <= 0) break;
      const currentDebt = parseFloat(salida.saldoAdeudado) || 0;
      if (currentDebt > 0) {
        if (pendingPayment >= currentDebt) {
          pendingPayment -= currentDebt;
          const docRef = doc(db, "salidas", salida.id);
          await updateDoc(docRef, { saldoAdeudado: 0 });
        } else {
          const newDebt = currentDebt - pendingPayment;
          pendingPayment = 0;
          const docRef = doc(db, "salidas", salida.id);
          await updateDoc(docRef, { saldoAdeudado: newDebt });
        }
      }
    }
    return { id: docRef.id, ...newAbono };
  } else {
    const abonos = getLocalData("abonos_salidas");
    newAbono.id = "absal-" + Math.random().toString(36).substr(2, 9);
    abonos.push(newAbono);
    setLocalData("abonos_salidas", abonos);

    // Recalculate locally
    const salidas = getLocalData("salidas");
    const clientSalidasIdx = [];
    salidas.forEach((s, idx) => {
      if (s.clienteName.toLowerCase().trim() === abono.clienteName.toLowerCase().trim()) {
        clientSalidasIdx.push(idx);
      }
    });

    // Sort index list by date of the corresponding invoice
    clientSalidasIdx.sort((a, b) => new Date(salidas[a].fecha) - new Date(salidas[b].fecha));

    let pendingPayment = newAbono.montoUSD;

    for (let idx of clientSalidasIdx) {
      if (pendingPayment <= 0) break;
      const currentDebt = parseFloat(salidas[idx].saldoAdeudado) || 0;
      if (currentDebt > 0) {
        if (pendingPayment >= currentDebt) {
          pendingPayment -= currentDebt;
          salidas[idx].saldoAdeudado = 0;
        } else {
          salidas[idx].saldoAdeudado = currentDebt - pendingPayment;
          pendingPayment = 0;
        }
      }
    }
    setLocalData("salidas", salidas);
    return newAbono;
  }
};

export const deleteAbonoSalida = async (abonoId, clienteName, montoUSD) => {
  const amount = parseFloat(montoUSD) || 0;

  if (isFirebaseConfigured && db) {
    // 1. Delete the abono document
    const abonoRef = doc(db, "abonos_salidas", abonoId);
    await deleteDoc(abonoRef);

    // 2. Recalculate client balances from scratch (all remaining abonos)
    const salidasList = await getSalidas();
    const clientSalidas = salidasList.filter(s => s.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());
    const remainingAbonos = (await getAbonosSalidas()).filter(a => a.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());

    const sortedSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Reset all balances to original totals
    const tempBalances = {};
    sortedSalidas.forEach(s => {
      tempBalances[s.id] = parseFloat(s.totalFactura) || 0;
    });

    let totalAbonado = remainingAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);

    for (let s of sortedSalidas) {
      const debt = tempBalances[s.id];
      if (totalAbonado >= debt) {
        tempBalances[s.id] = 0;
        totalAbonado -= debt;
      } else {
        tempBalances[s.id] = Math.max(0, debt - totalAbonado);
        totalAbonado = 0;
      }
    }

    // Update all invoices in Firebase
    for (let s of sortedSalidas) {
      const sRef = doc(db, "salidas", s.id);
      await updateDoc(sRef, { saldoAdeudado: tempBalances[s.id] });
    }
  } else {
    // Local Storage
    const abonos = getLocalData("abonos_salidas");
    const filteredAbonos = abonos.filter(a => a.id !== abonoId);
    setLocalData("abonos_salidas", filteredAbonos);

    // Recalculate local balances
    const salidas = getLocalData("salidas");
    const clientSalidas = salidas.filter(s => s.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());
    const clientAbonos = filteredAbonos.filter(a => a.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim());

    const sortedClientSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const tempBalances = {};
    sortedClientSalidas.forEach(s => {
      tempBalances[s.id] = parseFloat(s.totalFactura) || 0;
    });

    let totalClientAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);

    for (let s of sortedClientSalidas) {
      const debt = tempBalances[s.id];
      if (totalClientAbonado >= debt) {
        tempBalances[s.id] = 0;
        totalClientAbonado -= debt;
      } else {
        tempBalances[s.id] = Math.max(0, debt - totalClientAbonado);
        totalClientAbonado = 0;
      }
    }

    salidas.forEach(s => {
      if (s.clienteName.toLowerCase().trim() === clienteName.toLowerCase().trim()) {
        s.saldoAdeudado = tempBalances[s.id];
      }
    });

    setLocalData("salidas", salidas);
  }
};

// --- DYNAMIC STOCK & INVENTORY LEVEL CALCULATION ---
export const getInventario = async () => {
  const entradas = await getEntradas();
  const salidas = await getSalidas();

  const stock = {};

  // Process Entradas (Add to stock)
  entradas.forEach(ent => {
    if (ent.items && Array.isArray(ent.items)) {
      ent.items.forEach(item => {
        const prodKey = item.producto.trim();
        if (!stock[prodKey]) {
          stock[prodKey] = {
            nombre: prodKey,
            entradasBultos: 0,
            entradasKg: 0,
            salidasBultos: 0,
            salidasKg: 0,
            stockBultos: 0,
            stockKg: 0
          };
        }
        
        const cant = parseFloat(item.cantidad) || 0;
        if (item.unidad === "bulto") {
          stock[prodKey].entradasBultos += cant;
          stock[prodKey].stockBultos += cant;
        } else if (item.unidad === "kg") {
          stock[prodKey].entradasKg += cant;
          stock[prodKey].stockKg += cant;
        }
      });
    }
  });

  // Process Salidas (Subtract from stock)
  salidas.forEach(sal => {
    if (sal.items && Array.isArray(sal.items)) {
      sal.items.forEach(item => {
        const prodKey = item.producto.trim();
        if (!stock[prodKey]) {
          stock[prodKey] = {
            nombre: prodKey,
            entradasBultos: 0,
            entradasKg: 0,
            salidasBultos: 0,
            salidasKg: 0,
            stockBultos: 0,
            stockKg: 0
          };
        }

        const cant = parseFloat(item.cantidad) || 0;
        if (item.unidad === "bulto") {
          stock[prodKey].salidasBultos += cant;
          stock[prodKey].stockBultos -= cant;
        } else if (item.unidad === "kg") {
          stock[prodKey].salidasKg += cant;
          stock[prodKey].stockKg -= cant;
        }
      });
    }
  });

  return Object.values(stock);
};

// --- DELETE SERVICES ---
export const deleteEntrada = async (id) => {
  if (isFirebaseConfigured && db) {
    // 1. Delete the entrada document
    const docRef = doc(db, "entradas", id);
    await deleteDoc(docRef);

    // 2. Delete related abonos of this entrada
    try {
      const abonosList = await getAbonosEntradas();
      const relatedAbonos = abonosList.filter(a => a.entradaId === id);
      for (let abono of relatedAbonos) {
        const abonoRef = doc(db, "abonos_entradas", abono.id);
        await deleteDoc(abonoRef);
      }
    } catch (e) {
      console.error("Error deleting related abonos: ", e);
    }
  } else {
    // Local Storage
    const list = getLocalData("entradas");
    const filtered = list.filter(e => e.id !== id);
    setLocalData("entradas", filtered);

    const abonos = getLocalData("abonos_entradas");
    const filteredAbonos = abonos.filter(a => a.entradaId !== id);
    setLocalData("abonos_entradas", filteredAbonos);
  }
};

export const deleteSalida = async (id) => {
  if (isFirebaseConfigured && db) {
    // 1. Fetch the salida to get the client name
    const salidasList = await getSalidas();
    const salida = salidasList.find(s => s.id === id);
    if (!salida) return;
    const clientName = salida.clienteName;

    // 2. Delete the salida document
    const docRef = doc(db, "salidas", id);
    await deleteDoc(docRef);

    // 3. Recalculate balances for the remaining invoices of this client
    const remainingSalidas = (await getSalidas()).filter(s => s.clienteName === clientName);
    const abonosList = await getAbonosSalidas();
    const clientAbonos = abonosList.filter(a => a.clienteName === clientName);

    // Sort client outputs by date ascending to pay oldest first
    const sortedClientSalidas = [...remainingSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    const tempBalances = {};
    sortedClientSalidas.forEach(s => {
      tempBalances[s.id] = parseFloat(s.totalFactura) || 0;
    });

    let totalClientAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);

    for (let s of sortedClientSalidas) {
      const debt = tempBalances[s.id];
      if (totalClientAbonado >= debt) {
        tempBalances[s.id] = 0;
        totalClientAbonado -= debt;
      } else {
        tempBalances[s.id] = Math.max(0, debt - totalClientAbonado);
        totalClientAbonado = 0;
      }
    }

    // Update remaining invoices in Firebase
    for (let s of sortedClientSalidas) {
      const otherRef = doc(db, "salidas", s.id);
      await updateDoc(otherRef, { saldoAdeudado: tempBalances[s.id] });
    }
  } else {
    // Local Storage
    const list = getLocalData("salidas");
    const salida = list.find(s => s.id === id);
    if (!salida) return;
    const clientName = salida.clienteName;

    const filtered = list.filter(s => s.id !== id);
    
    // Recalculate client balances locally
    const clientSalidas = filtered.filter(s => s.clienteName === clientName);
    const abonosList = getLocalData("abonos_salidas");
    const clientAbonos = abonosList.filter(a => a.clienteName === clientName);

    const sortedClientSalidas = [...clientSalidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const tempBalances = {};
    sortedClientSalidas.forEach(s => {
      tempBalances[s.id] = parseFloat(s.totalFactura) || 0;
    });

    let totalClientAbonado = clientAbonos.reduce((sum, a) => sum + (parseFloat(a.montoUSD) || 0), 0);

    for (let s of sortedClientSalidas) {
      const debt = tempBalances[s.id];
      if (totalClientAbonado >= debt) {
        tempBalances[s.id] = 0;
        totalClientAbonado -= debt;
      } else {
        tempBalances[s.id] = Math.max(0, debt - totalClientAbonado);
        totalClientAbonado = 0;
      }
    }

    // Apply to filtered list
    filtered.forEach(s => {
      if (s.clienteName === clientName) {
        s.saldoAdeudado = tempBalances[s.id];
      }
    });

    setLocalData("salidas", filtered);
  }
};
