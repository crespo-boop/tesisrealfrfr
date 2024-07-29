document.addEventListener('DOMContentLoaded', function() {
    // Función para cargar los períodos en el desplegable
    function cargarPeriodos() {
        fetch('/get-periodos')
            .then(response => response.json())
            .then(data => {
                var periodoSelect = document.getElementById('periodo');
                periodoSelect.innerHTML = ''; // Limpiar opciones existentes
                data.forEach(periodo => {
                    var option = document.createElement('option');
                    option.value = periodo.id;
                    option.textContent = periodo.nombre;
                    periodoSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error al cargar los períodos:', error);
            });
    }

    // Función para guardar el nuevo período
    function guardarPeriodo() {
        var nombre = document.getElementById('nuevo-periodo-nombre').value;
        var fechaInicio = document.getElementById('nuevo-periodo-fecha-inicio').value;
        var fechaFin = document.getElementById('nuevo-periodo-fecha-fin').value;

        fetch('/agregar-periodo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre, fechaInicio, fechaFin })
        })
        .then(response => response.text())
        .then(message => {
            alert(message);
            // Volver a cargar los períodos en el desplegable
            cargarPeriodos();
            closeAddPeriodModal(); // Cerrar la ventana emergente
        })
        .catch(error => {
            console.error('Error al guardar el período:', error);
            alert('Hubo un error al guardar el período');
        });
    }

    // Función para generar PDFs
    function generatePDF(type, studentId) {
        fetch(`/generate-pdf/${type}/${studentId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al generar el PDF');
                }
                return response.blob();
            })
            .then(blob => {
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = `${type}_${studentId}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Error al generar el PDF:', error);
            });
    }

    // Función para cargar los estudiantes
    function fetchAllStudents() {
        fetch('/all-students')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error en la solicitud de estudiantes');
                }
                return response.json();
            })
            .then(data => {
                var studentsTable = document.getElementById('students-table');

                if (!studentsTable) {
                    console.error('No se encontró el elemento con ID "students-table".');
                    return;
                }

                studentsTable.innerHTML = '';

                var headerRow = document.createElement('tr');
                headerRow.innerHTML = `
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Carrera</th>
                    <th>Email</th>
                    <th>Semestre</th>
                    <th>Periodo</th>
                    <th>Código de Matrícula</th>
                    <th>Reporte</th>
                    <th>Certificado</th>
                `;
                studentsTable.appendChild(headerRow);

                if (data.length > 0) {
                    data.forEach(student => {
                        var studentRow = document.createElement('tr');
                        studentRow.innerHTML = `
                            <td>${student.id}</td>
                            <td>${student.Nombres}</td>
                            <td>${student.Cedula}</td>
                            <td>${student.Carrera}</td>
                            <td>${student.email}</td>
                            <td>${student.Semestre}</td>
                            <td>${student.Periodo}</td>
                            <td>${student.CodigoMatricula}</td>
                            <td><button class="report-button" data-id="${student.id}" data-student='${JSON.stringify(student)}'><i class="fas fa-file-alt"></i></button></td>
                            <td><button class="certificate-button" data-id="${student.id}" data-student='${JSON.stringify(student)}'><i class="fas fa-certificate"></i></button></td>
                        `;
                        studentsTable.appendChild(studentRow);

                        // Añadir event listeners después de añadir los elementos al DOM
                        var certificateButton = studentRow.querySelector('.certificate-button');
                        if (certificateButton) {
                            certificateButton.addEventListener('click', function() {
                                var studentData = this.getAttribute('data-student');
                                window.location.href = `certificados.html?student=${encodeURIComponent(studentData)}`;
                            });
                        }

                        var reportButton = studentRow.querySelector('.report-button');
                        if (reportButton) {
                            reportButton.addEventListener('click', function() {
                                var studentData = this.getAttribute('data-student');
                                window.location.href = `reportes.html?student=${encodeURIComponent(studentData)}`;
                            });
                        }
                    });
                } else {
                    var noStudentsRow = document.createElement('tr');
                    var noStudentsCell = document.createElement('td');
                    noStudentsCell.colSpan = 10;
                    noStudentsCell.textContent = 'No se encontraron estudiantes.';
                    noStudentsRow.appendChild(noStudentsCell);
                    studentsTable.appendChild(noStudentsRow);
                }
            })
            .catch(error => {
                console.error('Error al cargar los estudiantes:', error);
                var studentsTable = document.getElementById('students-table');
                if (studentsTable) {
                    studentsTable.innerHTML = '<tr><td colspan="10">Error al cargar los estudiantes.</td></tr>';
                }
            });
    }

    // Función para manejar la carga masiva de archivos
    function cargamasiva() {
        var fileInput = document.getElementById('file-input');
        if (fileInput) {
            var file = fileInput.files[0];

            if (!file) {
                alert('Seleccione un archivo para cargar.');
                return;
            }

            var formData = new FormData();
            formData.append('file', file);

            fetch('/cargar-masivo', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message); // Muestra un mensaje de éxito o error
                fetchAllStudents(); // Recargar la lista de estudiantes después de la carga masiva
            })
            .catch(error => {
                console.error('Error en la carga masiva:', error);
                alert('Hubo un error en la carga masiva');
            });
        } else {
            console.error('No se encontró el elemento con ID "file-input".');
        }
    }

    // Asignar el evento al botón de carga masiva
    var loadFileButton = document.querySelector('#load-file-button');
    if (loadFileButton) {
        loadFileButton.addEventListener('click', cargamasiva);
    }

    // Asignar el evento al botón de búsqueda
    var searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            var searchType = document.getElementById('search-type').value;
            var searchTerm = document.getElementById('search-input').value;

            if (searchType.trim() === '' || searchTerm.trim() === '') {
                alert('Por favor ingresa un tipo y un término de búsqueda válidos.');
                return;
            }

            fetch(`/search?type=${searchType}&term=${searchTerm}`)
                .then(response => response.json())
                .then(data => {
                    var resultsTable = document.getElementById('students-table');
                    if (!resultsTable) {
                        console.error('No se encontró el elemento con ID "students-table".');
                        return;
                    }
                    resultsTable.innerHTML = '';

                    if (data.length > 0) {
                        var headerRow = document.createElement('tr');
                        headerRow.innerHTML = `
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Cédula</th>
                            <th>Carrera</th>
                            <th>Email</th>
                            <th>Semestre</th>
                            <th>Periodo</th>
                            <th>Código de Matrícula</th>
                            <th>Reporte</th>
                            <th>Certificado</th>
                        `;
                        resultsTable.appendChild(headerRow);

                        data.forEach(result => {
                            var resultRow = document.createElement('tr');
                            resultRow.innerHTML = `
                                <td>${result.id}</td>
                                <td>${result.Nombres}</td>
                                <td>${result.Cedula}</td>
                                <td>${result.Carrera}</td>
                                <td>${result.email}</td>
                                <td>${result.Semestre}</td>
                                <td>${result.Periodo}</td>
                                <td>${result.CodigoMatricula}</td>
                                <td><button class="report-button" data-id="${result.id}"><i class="fas fa-file-alt"></i></button></td>
                                <td><button class="certificate-button" data-id="${result.id}" data-student='${JSON.stringify(result)}'><i class="fas fa-certificate"></i></button></td>
                            `;
                            resultsTable.appendChild(resultRow);

                            // Añadir event listeners después de añadir los elementos al DOM
                            var certificateButton = resultRow.querySelector('.certificate-button');
                            if (certificateButton) {
                                certificateButton.addEventListener('click', function() {
                                    var studentData = this.getAttribute('data-student');
                                    window.location.href = `certificados.html?student=${encodeURIComponent(studentData)}`;
                                });
                            }

                            var reportButton = resultRow.querySelector('.report-button');
                            if (reportButton) {
                                reportButton.addEventListener('click', function() {
                                    var studentData = this.getAttribute('data-student');
                                    window.location.href = `reportes.html?student=${encodeURIComponent(studentData)}`;
                                });
                            }
                        });
                    } else {
                        var noResultsRow = document.createElement('tr');
                        var noResultsCell = document.createElement('td');
                        noResultsCell.colSpan = 10;
                        noResultsCell.textContent = 'No se encontraron resultados.';
                        noResultsRow.appendChild(noResultsCell);
                        resultsTable.appendChild(noResultsRow);
                    }
                })
                .catch(error => {
                    console.error('Error en la búsqueda:', error);
                    var resultsTable = document.getElementById('students-table');
                    if (resultsTable) {
                        resultsTable.innerHTML = '<tr><td colspan="10">Error al buscar estudiantes.</td></tr>';
                    }
                });
        });
    }

    // Cargar períodos cuando se cargue la página
    cargarPeriodos();

    // Asignar el evento al botón de guardar período
    var savePeriodButton = document.querySelector('#add-period-form button[type="button"]');
    if (savePeriodButton) {
        savePeriodButton.addEventListener('click', guardarPeriodo);
    }
});
