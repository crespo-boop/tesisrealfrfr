// Importa los módulos necesarios
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const fileUpload = require('express-fileupload');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const db = require('./config'); // Importa la configuración de la base de datos desde './config'
const fs = require('fs');
const doc = new PDFDocument();

const app = express();
const port = 3001;


function getCurrentDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = ('0' + (today.getMonth() + 1)).slice(-2); // Meses de 2 dígitos
    const day = ('0' + today.getDate()).slice(-2); // Días de 2 dígitos
    return `${year}-${month}-${day}`;
}


// Middleware para parsear JSON y URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para manejar archivos subidos
app.use(fileUpload());

// Middleware para manejar sesiones
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// Middleware para servir archivos estáticos desde el directorio 'public'
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'css')));


// Ruta para guardar un estudiante en la base de datos
app.post('/guardar-estudiante', (req, res) => {
    const { nombres, cedula, carrera, email, semestre } = req.body;

    // Ejecutar la consulta SQL para insertar el estudiante
    db.query('INSERT INTO estudiantes (Nombres, Cedula, Carrera, email, Semestre) VALUES (?, ?, ?, ?, ?)', [nombres, cedula, carrera, email, semestre], (error, results) => {
        if (error) {
            console.error('Error al insertar estudiante:', error);
            return res.status(500).send('Error interno del servidor');
        }
        res.send('Estudiante guardado correctamente');
    });
});

app.post('/agregar-periodo', (req, res) => {
    const { nombre, fechaInicio, fechaFin } = req.body;
    const query = 'INSERT INTO Periodo (nombre, fechaInicio, fechaFin) VALUES (?, ?, ?)';

    db.query(query, [nombre, fechaInicio, fechaFin], (err, result) => {
        if (err) {
            console.error('Error al guardar el período:', err);
            return res.status(500).send('Error al guardar el período');
        }
        res.send('Período guardado exitosamente');
    });
});

// Ruta para obtener los períodos
app.get('/get-periodos', (req, res) => {
    const query = 'SELECT * FROM Periodo';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los períodos:', err);
            return res.status(500).send('Error al obtener los períodos');
        }
        res.json(results);
    });
});

// Ruta para mostrar el formulario de carga de datos
app.get('/cargarDatos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cargarDatos.html'));
});

// Ruta para manejar la carga masiva de datos desde un archivo Excel
app.post('/cargar-masivo', (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ message: 'No se ha proporcionado ningún archivo.' });
    }

    const file = req.files.file;

    try {
        const workbook = xlsx.read(file.data, { type: 'buffer' });
        const sheet_name_list = workbook.SheetNames;
        const xlData = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

        if (xlData.length === 0) {
            return res.status(400).json({ message: 'El archivo Excel está vacío.' });
        }

        // Crear un arreglo para almacenar las promesas de cada inserción
        const insertPromises = xlData.map(row => {
            const { Nombres, Cedula, Carrera, email, Semestre } = row;
            const sql = 'INSERT INTO estudiantes (Nombres, Cedula, Carrera, email, Semestre) VALUES (?, ?, ?, ?, ?)';
            const values = [Nombres, Cedula, Carrera, email, Semestre];
            return new Promise((resolve, reject) => {
                db.query(sql, values, (error, results) => {
                    if (error) {
                        console.error('Error al insertar datos:', error);
                        reject(error);
                    } else {
                        resolve(results);
                    }
                });
            });
        });

        // Ejecutar todas las inserciones en paralelo
        Promise.all(insertPromises)
            .then(() => {
                res.json({ message: 'Datos cargados exitosamente.' });
            })
            .catch(error => {
                console.error('Error al cargar datos:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            });
    } catch (error) {
        console.error('Error al procesar el archivo Excel:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


// Ruta para manejar la búsqueda de estudiantes
app.get('/search', (req, res) => {
    const { type, term } = req.query;

    // Verifica el tipo de búsqueda (cedula o nombre) y ajusta la consulta SQL
    let sqlQuery = '';
    let sqlParams = [];
    if (type === 'cedula') {
        sqlQuery = 'SELECT * FROM estudiantes WHERE Cedula = ?';
        sqlParams = [term];
    } else if (type === 'nombre') {
        sqlQuery = 'SELECT * FROM estudiantes WHERE Nombres LIKE ?';
        sqlParams = [`%${term}%`];
    } else {
        return res.status(400).json({ error: 'Tipo de búsqueda no válido' });
    }

    // Ejecuta la consulta con el término de búsqueda proporcionado
    db.query(sqlQuery, sqlParams, (error, results) => {
        if (error) {
            console.error('Error en la búsqueda:', error);
            res.status(500).json({ error: 'Error en la búsqueda' });
        } else {
            res.json(results);
        }
    });
});

// Ruta para obtener todos los estudiantes
app.get('/all-students', (req, res) => {
    db.query('SELECT * FROM estudiantes', (error, results) => {
        if (error) {
            console.error('Error al obtener los estudiantes:', error);
            res.status(500).json({ error: 'Error al obtener los estudiantes' });
        } else {
            res.json(results);
        }
    });
});


// Ruta para generar y descargar un certificado en PDF con datos dinámicos
app.get('/generar-pdf/:type/:id', (req, res) => {
    const type = req.params.type;
    const studentId = req.params.id;

    // Consultar la base de datos para obtener los datos del estudiante
    db.query('SELECT * FROM estudiantes WHERE id = ?', [studentId], (error, results) => {
        if (error) {
            console.error('Error al consultar datos del estudiante:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }

        const studentData = results[0];

        // Iniciar el documento PDF
        const doc = new PDFDocument();

        // Configurar encabezados, fuentes, estilos, etc.
        doc.font('Times-Roman');

        // Agregar contenido específico al certificado
        if (type === 'certificado-conducta') {
            // Obtener la altura de la página
            const pageHeight = doc.page.height;
            
            // Definir la altura del texto y centrarlo verticalmente
            const textHeight = 100; // Ajusta según sea necesario
            
            // Calcular la posición vertical centrada
            const verticalPosition = (pageHeight - textHeight) / 2;
            
            // Escribir el texto utilizando la posición vertical calculada
            doc.fontSize(15)
               .text('Certificado de Conducta', 50, verticalPosition)
               .text(`Este certificado es otorgado a ${studentData.Nombres} con C.I. ${studentData.Cedula}, estudiante de la carrera de ${studentData.Carrera} en la facultad "Ciencias de la vida y la tecnología" por su excelente conducta en la Universidad.`, 50, verticalPosition + 50);
        } else if (type === 'certificado-practicas') {
            // Obtener la altura de la página
            const pageHeight = doc.page.height;
            const textHeight = 200; // Ajusta según sea necesario
            const verticalPosition = (pageHeight - textHeight) / 2;
            const textMargin = 50; // Margen desde el borde
            const lineHeight = 15; // Altura de cada línea

            // Escribir el texto utilizando la posición vertical calculada
            // Configurar el título
            doc.fontSize(15)
            .text('Certificado de Prácticas', { align: 'center' })
            .moveDown(1); // Espaciado después del título

            // Texto principal
            doc.fontSize(12)
            .text('La suscrita secretaria de la Carrera de Tecnologías de la Información de la Facultad de Ciencias de la Vida y Tecnologías de la Universidad Laica Eloy Alfaro de Manabí.', textMargin, verticalPosition, { width: 450, align: 'justify' })
            .moveDown(2); // Espaciado después del primer bloque

            // Texto "CERTIFICA"
            doc.fontSize(12)
            .text('CERTIFICA', { align: 'center' })
            .moveDown(2); // Espaciado después de "CERTIFICA"

            // Segundo bloque de texto
            doc.text(`Que revisado los registros del Sistema de Gestión Académica SGA, el señor ${studentData.Nombres} con C.I. ${studentData.Cedula}, consta matriculado en el ${studentData.Semestre} NIVEL de la carrera de ${studentData.Carrera}, periodo académico ${new Date().getFullYear()}, con registro de matrícula 2023P3-10860. El peticionario puede hacer uso de la presente para trámites universitarios de becas.`, textMargin, doc.y, { width: 450, align: 'justify' })
            .moveDown(2); // Espaciado después del segundo bloque

            // Texto "Lo Certifica,"
            doc.text('Lo Certifica,', { align: 'center' })
            .moveDown(2); // Espaciado después de "Lo Certifica,"

            // Texto final
            doc.text('Ing. María Elena Garcia Vélez', { align: 'center' })
            .text('Secretaria Carrera de Tecnologías de la Información', { align: 'center' })
            .text(`Manta, ${new Date().toLocaleDateString()}`, { align: 'center' });
       
            } else if (type === 'certificado-matricula') {
            // Obtener la altura de la página
            const pageHeight = doc.page.height;
            const textHeight = 200; // Ajusta según sea necesario
            const verticalPosition = (pageHeight - textHeight) / 2;
            const textMargin = 50; // Margen desde el borde
            const lineHeight = 15; // Altura de cada línea
            
          // Configurar el título
            doc.fontSize(15)
            .text('Certificado de Matrícula', { align: 'center' })
            .moveDown(1); // Espaciado después del título

        // Texto principal
            doc.fontSize(12)
            .text('Certificado otorgado a:', { align: 'center' })
            .moveDown(1) // Espaciado después del texto "Certificado otorgado a:"
            .text(studentData.Nombres, { align: 'center' })
            .moveDown(2) // Espaciado después del nombre
            .text(`Por haber culminado satisfactoriamente las 48 horas de Prácticas Preprofesionales correspondientes a "Prácticas Laborales II (séptimo Nivel)", realizadas en Administrador Facultad de Ciencias de la Vida y Tecnologías y supervisadas por el Ing. Hiraida Santana, Mg en el periodo ${new Date().getFullYear()}-${new Date().getFullYear() + 1}.`, textMargin, doc.y, { width: 450, align: 'justify' })
            .moveDown(2) // Espaciado después del texto principal
            .text(`Manta, ${new Date().toLocaleDateString()}`, { align: 'center' })
            .moveDown(2) // Espaciado después de la fecha

            // Texto final
            doc.text('Lic. Dolores Muñoz Verduga, PhD.', { align: 'center' })
            .text('Decana de la Facultad de Ciencias de la Vida y la Tecnología', { align: 'center' })
            .moveDown(1)
            .text('Ing. Elsa Hiraida Santana, Mg.', { align: 'center' })
            .text('Responsable de la Comisión de Prácticas Preprofesionales Carreras de Ingeniería en Sistemas y Tecnologías de la Información', { align: 'center' });

     }
            
        
        // Agregar imagen al certificado
        const imagePath1 = path.join(__dirname, 'imagen', 'imagen-1.png');
        const imagePath2 = path.join(__dirname, 'imagen', 'imagen-2.jpeg');
        const imagePath3 = path.join(__dirname, 'imagen', 'imagen-3.jpeg');

            // Ajusta la posición y tamaño de cada imagen según sea necesario
            try {
                if (fs.existsSync(imagePath1)) {
                    // Imagen 1 en la parte superior izquierda
                    doc.image(imagePath1, 50, 50, { width: 150 });
                } else {
                    console.warn(`La imagen 'imagen-1.png' no se encontró en el directorio 'imagen'.`);
                }

                if (fs.existsSync(imagePath2)) {
                    // Imagen 2 en la parte superior derecha
                    doc.image(imagePath2, 400, 50, { width: 150 });
                } else {
                    console.warn(`La imagen 'imagen-2.jpeg' no se encontró en el directorio 'imagen'.`);
                }

                if (fs.existsSync(imagePath3)) {
                    // Imagen 3 en la parte inferior izquierda
                    doc.image(imagePath3, 50, 600, { width: 150 });
                } else {
                    console.warn(`La imagen 'imagen-3.jpeg' no se encontró en el directorio 'imagen'.`);
                }
            } catch (err) {
                console.error('Error al cargar las imágenes:', err);
            }






        // Finalizar y descargar el PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${type}_${studentData.Cedula}.pdf`);
        doc.pipe(res);
        doc.end();






    });
});

app.get('/generar-report/:type/:id', (req, res) => {
    const type = req.params.type;
    const studentId = req.params.id;

    db.query('SELECT * FROM estudiantes WHERE id = ?', [studentId], (error, results) => {
        if (error) {
            console.error('Error al consultar datos del estudiante:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }

        const studentData = results[0];
        const doc = new PDFDocument();

        res.setHeader('Content-Disposition', `inline; filename=reporte_${type}_${studentId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        // Lógica para el reporte
        try {
            if (type === 'informe-general') {
                doc.fontSize(15)
                   
                const pageHeight = doc.page.height; // Obtener la altura de la página
                const textHeight = 200; // Ajusta según sea necesario
                const verticalPosition = (pageHeight - textHeight) / 2;
                const textMargin = 50;
                const lineHeight = 15; 
                doc.fontSize(18)
       .text('Informe General', { align: 'center' })
       .moveDown(1); // Espaciado después del título

                // Añadir el primer bloque de texto
                doc.fontSize(12)
                .text('La suscrito Decanato de la Carrera de Tecnologías de la Información de la Facultad de Ciencias de la Vida y Tecnologías de la Universidad Laica Eloy Alfaro de Manabí.', textMargin, verticalPosition, { width: 450, align: 'justify' })
                .moveDown(1.5); // Espaciado después del primer bloque

                // Añadir "Informa"
                doc.text('Informa', textMargin, doc.y, { align: 'center' })
                .moveDown(1.5); // Espaciado después de "Informa"

                // Añadir el segundo bloque de texto
                doc.text(`Debido a su excelente desempeño académico, el estudiante ${studentData.Nombres} con C.I. ${studentData.Cedula} de la carrera ${studentData.Carrera} del ${studentData.Semestre} nivel, por su destacada participación lo hace acreedor a reconocimiento`, textMargin, doc.y, { width: 450, align: 'justify' })
                .moveDown(2); // Espaciado después del segundo bloque

                // Añadir el siguiente bloque de texto
                doc.text('Lo Certifica,', textMargin)
                .moveDown(1); // Espaciado después de "Lo Certifica,"

                // Añadir el siguiente bloque de texto
                doc.text('Lic. Dolores Muñoz Verduga, PhD.', textMargin)
                .text('Decana Facultad de Ciencias de la Vida y Tecnologías', textMargin)
                .moveDown(2); // Espaciado después de la firma

                // Añadir la fecha
                doc.text(`Manta, ${getCurrentDate()}`, textMargin);
            } else if (type === 'reporte-conducta') {
                doc.fontSize(15)
                   .text('Reporte de Conducta', 50, 100);
                
                const pageHeight = doc.page.height; // Obtener la altura de la página
                const textHeight = 200; // Ajusta según sea necesario
                const verticalPosition = (pageHeight - textHeight) / 2;
                const textMargin = 50;
                // Texto principal
                doc.fontSize(12)
                .text('La suscrita asociación estudiantil de la Carrera de Tecnologías de la Información de la Facultad de Ciencias de la Vida y Tecnologías de la Universidad Laica Eloy Alfaro de Manabí.', textMargin, verticalPosition, { width: 450, align: 'justify' })
                .moveDown(2); // Espaciado después del primer bloque

                // Texto "Reporta"
                doc.fontSize(12)
                    .text('Reporta', { align: 'center' })
                    .moveDown(1); // Espaciado después de "Reporta"

                // Segundo bloque de texto
                doc.text(`Que el señor ${studentData.Nombres} con C.I. ${studentData.Cedula}, del ${studentData.Semestre} NIVEL de la carrera de Tecnologías de la Información, periodo académico ${new Date().getFullYear()}, con registro de matrícula 2023P3-10860. Se ha involucrado en una acción sancionable.`, textMargin, doc.y, { width: 450, align: 'justify' })
                    .moveDown(2); // Espaciado después del segundo bloque

                // Texto adicional
                doc.text('Estas actividades le han generado un reporte que estará presente en futuras observaciones.', textMargin, doc.y, { width: 450, align: 'justify' })
                    .moveDown(2); // Espaciado después del texto adicional

                // Texto "Lo Certifica,"
                doc.text('Lo Certifica,', { align: 'center' })
                    .moveDown(1); // Espaciado después de "Lo Certifica,"

                // Texto final
                doc.text('Asociación estudiantil', { align: 'center' })
                    .text(`Manta, ${getCurrentDate()}`, { align: 'center' });
            } else {
                res.status(404).send('Reporte no encontrado');
                return;
            }
        } catch (error) {
            console.error('Error al generar el reporte:', error);
            res.status(500).send('Error al generar el reporte');
        }
        
        // Agregar imagen al certificado
        const imagePath1 = path.join(__dirname, 'imagen', 'imagen-1.png');
        const imagePath2 = path.join(__dirname, 'imagen', 'imagen-2.jpeg');
        const imagePath3 = path.join(__dirname, 'imagen', 'imagen-3.jpeg');

            // Ajusta la posición y tamaño de cada imagen según sea necesario
            try {
                if (fs.existsSync(imagePath1)) {
                    // Imagen 1 en la parte superior izquierda
                    doc.image(imagePath1, 50, 50, { width: 150 });
                } else {
                    console.warn(`La imagen 'imagen-1.png' no se encontró en el directorio 'imagen'.`);
                }

                if (fs.existsSync(imagePath2)) {
                    // Imagen 2 en la parte superior derecha
                    doc.image(imagePath2, 400, 50, { width: 150 });
                } else {
                    console.warn(`La imagen 'imagen-2.jpeg' no se encontró en el directorio 'imagen'.`);
                }

                if (fs.existsSync(imagePath3)) {
                    // Imagen 3 en la parte inferior izquierda
                    doc.image(imagePath3, 50, 600, { width: 150 });
                } else {
                    console.warn(`La imagen 'imagen-3.jpeg' no se encontró en el directorio 'imagen'.`);
                }
            } catch (err) {
                console.error('Error al cargar las imágenes:', err);
            }

        doc.end();
    });
});


// Rutas de autenticación y gestión de sesiones
app.post('/login', (req, res) => {
    const usuario = req.body.username;
    const password = req.body.password;

    if (usuario && password) {
        db.query('SELECT * FROM login WHERE usuario = ?', [usuario], async (error, results) => {
            if (error) {
                console.error('Error en la consulta de inicio de sesión:', error);
                res.send('Error en la consulta');
            } else if (results.length > 0) {
                const hashedPassword = results[0].password;
                const match = await bcrypt.compare(password, hashedPassword);
                if (match) {
                    req.session.loggedin = true;
                    req.session.usuario = usuario;
                    res.redirect('/pagina.html');
                } else {
                    res.send('Nombre de usuario o contraseña incorrectos');
                }
            } else {
                res.send('Nombre de usuario o contraseña incorrectos');
            }
            res.end();
        });
    } else {
        res.send('Por favor ingrese nombre de usuario y contraseña');
        res.end();
    }
});

app.post('/register', async (req, res) => {
    const email = req.body.email;
    const usuario = req.body.username;
    const password = req.body.password;

    if (email && usuario && password) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.query('INSERT INTO login (email, usuario, password) VALUES (?, ?, ?)', [email, usuario, hashedPassword], (error, results) => {
                if (error) {
                    console.error('Error al registrar usuario:', error);
                    res.status(500).send('Error al registrar usuario');
                } else {
                    res.redirect('/login.html');
                }
                res.end();
            });
        } catch (error) {
            console.error('Error al encriptar la contraseña:', error);
            res.status(500).send('Error al encriptar la contraseña');
        }
    } else {
        res.status(400).send('Por favor complete todos los campos');
    }
});

app.get('/pagina.html', (req, res) => {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'pagina.html'));
    } else {
        res.redirect('/login.html');
    }
}); 

app.get('/welcome-message', (req, res) => {
    if (req.session.loggedin) {
        res.json({ username: req.session.usuario });
    } else {
        res.status(401).send('No autorizado');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            res.status(500).send('Error al cerrar sesión');
        } else {
            res.redirect('/login.html');
        }
    });
});

// Iniciar el servidor en el puerto especificado
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
