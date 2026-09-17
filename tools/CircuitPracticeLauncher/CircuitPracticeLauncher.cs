using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

internal static class CircuitPracticeLauncher
{
    private const int StartupTimeoutSeconds = 30;
    private const int FirstPort = 5173;
    private const int LastPort = 5199;

    [STAThread]
    private static int Main()
    {
        Console.WriteLine("Circuit Practice");
        Console.WriteLine("================");

        string projectDirectory = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);

        if (!File.Exists(Path.Combine(projectDirectory, "package.json")))
        {
            ShowError(
                "No se encontro package.json junto al launcher.\n\n" +
                "Coloca CircuitPractice.exe en la carpeta raiz del proyecto.");
            return 1;
        }

        if (!Directory.Exists(Path.Combine(projectDirectory, "node_modules")))
        {
            ShowError(
                "No se encontro node_modules.\n\n" +
                "Abre una terminal en la carpeta del proyecto y ejecuta:\n" +
                "npm install");
            return 1;
        }

        string npmPath = FindNpmCommand();
        if (npmPath == null)
        {
            ShowError(
                "No se encontro Node.js/npm en el PATH.\n\n" +
                "Instala Node.js y vuelve a ejecutar el launcher.");
            return 1;
        }

        Process viteProcess = null;

        try
        {
            int port = FindAvailablePort();
            if (port == 0)
            {
                ShowError(
                    "No se encontro un puerto local disponible entre " +
                    FirstPort + " y " + LastPort + ".");
                return 1;
            }

            string localUrl = "http://127.0.0.1:" + port + "/";

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                Arguments = "/d /c \"\"" + npmPath +
                            "\" run dev -- --host 127.0.0.1 --port " + port + " --strictPort\"",
                WorkingDirectory = projectDirectory,
                UseShellExecute = false,
                CreateNoWindow = false
            };

            Console.WriteLine("Iniciando Vite...");
            viteProcess = Process.Start(startInfo);

            bool serverReady = false;
            DateTime deadline = DateTime.UtcNow.AddSeconds(StartupTimeoutSeconds);

            while (DateTime.UtcNow < deadline)
            {
                if (viteProcess == null || viteProcess.HasExited)
                {
                    break;
                }

                if (IsServerReady(localUrl))
                {
                    serverReady = true;
                    break;
                }

                Thread.Sleep(500);
            }

            if (!serverReady)
            {
                ShowError(
                    "Vite no pudo iniciar en el puerto " + port + ".\n\n" +
                    "Revisa la ventana de la terminal o ejecuta npm install.");
                return 1;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = localUrl,
                UseShellExecute = true
            });

            bool stopRequested = false;
            ConsoleCancelEventHandler cancelHandler = delegate(object sender, ConsoleCancelEventArgs args)
            {
                args.Cancel = true;
                stopRequested = true;
                StopProcessTree(viteProcess);
            };

            Console.CancelKeyPress += cancelHandler;
            AppDomain.CurrentDomain.ProcessExit += delegate
            {
                StopProcessTree(viteProcess);
            };

            Console.WriteLine();
            Console.WriteLine("Aplicacion disponible en " + localUrl);
            Console.WriteLine("El navegador se abrira automaticamente.");
            Console.WriteLine("Manten esta ventana abierta. Presiona Ctrl+C para detener Vite.");

            while (!stopRequested && viteProcess != null && !viteProcess.HasExited)
            {
                Thread.Sleep(500);
            }

            return 0;
        }
        catch (Exception exception)
        {
            ShowError("No se pudo iniciar Circuit Practice.\n\n" + exception.Message);
            return 1;
        }
    }

    private static void StopProcessTree(Process process)
    {
        try
        {
            if (process == null || process.HasExited)
            {
                return;
            }

            Process killer = Process.Start(new ProcessStartInfo
            {
                FileName = "taskkill.exe",
                Arguments = "/PID " + process.Id + " /T /F",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            });

            if (killer != null)
            {
                killer.WaitForExit(5000);
            }
        }
        catch
        {
            // The operating system may already have closed the process tree.
        }
    }

    private static bool IsServerReady(string localUrl)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(localUrl);
            request.Method = "GET";
            request.Timeout = 1000;
            request.ReadWriteTimeout = 1000;

            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                return (int)response.StatusCode >= 200 && (int)response.StatusCode < 500;
            }
        }
        catch (WebException)
        {
            return false;
        }
        catch (IOException)
        {
            return false;
        }
    }

    private static int FindAvailablePort()
    {
        for (int port = FirstPort; port <= LastPort; port++)
        {
            TcpListener listener = null;

            try
            {
                listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                return port;
            }
            catch (SocketException)
            {
                // Try the next port in the local range.
            }
            finally
            {
                if (listener != null)
                {
                    listener.Stop();
                }
            }
        }

        return 0;
    }

    private static string FindNpmCommand()
    {
        List<string> searchDirectories = new List<string>();
        string pathEnvironment = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;

        foreach (string directory in pathEnvironment.Split(Path.PathSeparator))
        {
            if (!string.IsNullOrWhiteSpace(directory))
            {
                searchDirectories.Add(directory.Trim());
            }
        }

        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        if (!string.IsNullOrWhiteSpace(programFiles))
        {
            searchDirectories.Add(Path.Combine(programFiles, "nodejs"));
        }

        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        if (!string.IsNullOrWhiteSpace(programFilesX86))
        {
            searchDirectories.Add(Path.Combine(programFilesX86, "nodejs"));
        }

        foreach (string directory in searchDirectories)
        {
            string candidate = Path.Combine(directory, "npm.cmd");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static void ShowError(string message)
    {
        MessageBox.Show(
            message,
            "Circuit Practice",
            MessageBoxButtons.OK,
            MessageBoxIcon.Error);
    }
}
