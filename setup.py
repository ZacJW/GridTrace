from setuptools import setup, find_packages
setup(
    name="GridSense",
    version="0.1",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "gridsense-web": ["static/*.html", "static/*.css", "static/*.js", "static/**/*.svg", "static/**/LICENSE"]
    }
)