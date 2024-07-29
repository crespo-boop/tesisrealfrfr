document.addEventListener('DOMContentLoaded', function() {
    var generateButtons = document.querySelectorAll('.generate-button');
    var addReportButton = document.getElementById('add-report-button');
    var modal = document.getElementById('modal');
    var closeModalButton = document.getElementById('close-modal');
    var acceptButton = document.getElementById('accept-button');
    var cancelButton = document.getElementById('cancel-button');

    generateButtons.forEach(button => {
        button.addEventListener('click', function() {
            var type = this.getAttribute('data-type');
            var studentData = getStudentDataFromURL();

            if (studentData) {
                generateReport(type, studentData);
            } else {
                console.error('No se encontraron datos del estudiante.');
            }
        });
    });

    addReportButton.addEventListener('click', function() {
        modal.style.display = 'block';
    });

    closeModalButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    cancelButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    acceptButton.addEventListener('click', function() {
        var titulo = document.getElementById('titulo').value;
        var fecha = document.getElementById('fecha').value;
        var descripcion = document.getElementById('descripcion').value;

        // Aquí puedes agregar la funcionalidad para manejar los datos ingresados
        console.log('Título:', titulo);
        console.log('Fecha de Emisión:', fecha);
        console.log('Descripción:', descripcion);

        // Ocultar la ventana emergente después de aceptar
        modal.style.display = 'none';

        // Limpia los campos después de aceptar
        document.getElementById('titulo').value = '';
        document.getElementById('fecha').value = '';
        document.getElementById('descripcion').value = '';
    });

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    function getStudentDataFromURL() {
        var urlParams = new URLSearchParams(window.location.search);
        var studentData = urlParams.get('student');
        if (studentData) {
            return JSON.parse(decodeURIComponent(studentData));
        } else {
            return null;
        }
    }

    function generateReport(type, studentData) {
        const url = `/generar-report/${type}/${studentData.id}`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al generar el reporte');
                }
                return response.blob();
            })
            .then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                // Abre el PDF en una nueva ventana o pestaña
                window.open(blobUrl, '_blank');
                window.URL.revokeObjectURL(blobUrl); // Libera el objeto URL después de usarlo
            })
            .catch(error => console.error('Error al generar el reporte:', error));
    }
});
